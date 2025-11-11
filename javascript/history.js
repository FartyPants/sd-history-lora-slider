const TEXT_TO_IMAGE = "txt2img";
const IMAGE_TO_IMAGE = "img2img";
const HISTORY_KEY = "history_prompt";
const PROMPT_KEY = "p";
const NEGATIVE_PROMPT_KEY = "n";
const LORA_REGEX = /<lora:([^:]+):(-?[0-9.]+?)>/g; 
const NUM_LORA_SLIDERS = 3;

// A global flag to prevent the Lora slider from creating history entries.
let isLoraSliderUpdate = false;

function _emptyPrompt() {
    return {
        [PROMPT_KEY]: "",
        [NEGATIVE_PROMPT_KEY]: "",
    }
}

function _initPromptHistory() {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(
        {
            [TEXT_TO_IMAGE]:
                [
                    {
                        [PROMPT_KEY]: "",
                        [NEGATIVE_PROMPT_KEY]: "",
                    }
                ],
            [IMAGE_TO_IMAGE]:
                [
                    {
                        [PROMPT_KEY]: "",
                        [NEGATIVE_PROMPT_KEY]: "",
                    }
                ]
        }
    ));
}


function _capturePrompts(tabname) {
    const prompt = "#" + tabname + "_prompt textarea";
    const negprompt = "#" + tabname + "_neg_prompt textarea";
    return {
        [PROMPT_KEY]: gradioApp().querySelector(prompt).value,
        [NEGATIVE_PROMPT_KEY]: gradioApp().querySelector(negprompt).value
    };
}

function _loadHistory(tabname) {
    let history;

    if (history = window.localStorage.getItem(HISTORY_KEY)) {
        history = JSON.parse(history);
        if (tabname) {
            return history[tabname];
        }
    }

    return history;
    
}

function _storeHistory(tabname) {
    let history = _loadHistory();
    const value = _capturePrompts(tabname);
    
    history[tabname].push(value);

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function _increaseSlider(tabname, number = 1) {
    const input = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider> div input"
    );
    const slider = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider> input"
    );
    slider.max = parseInt(slider.max) + number;
    slider.value = parseInt(slider.max);
    input.value = parseInt(slider.value);
}

// --- MODIFICATION START ---
/**
 * [PROMPT -> SLIDERS]
 * Updates Lora sliders based on the prompt, enabling/disabling them as needed.
 */
function updateLoraSliderFromPrompt(tabname) {
    const promptTextarea = gradioApp().querySelector(`#${tabname}_prompt textarea`);
    const loraMatches = Array.from(promptTextarea.value.matchAll(LORA_REGEX));

    for (let i = 0; i < NUM_LORA_SLIDERS; i++) {
        const sliderIndex = i + 1;
        const loraSlider = gradioApp().querySelector(`#${tabname}_lora_weights_slider_${sliderIndex} input[type=range]`);
        const numberInput = gradioApp().querySelector(`#${tabname}_lora_weights_slider_${sliderIndex} input[type=number]`);
        const loraSliderLabel = gradioApp().querySelector(`#${tabname}_lora_weights_slider_${sliderIndex} span[data-testid="block-info"]`);

        if (!loraSlider || !numberInput || !loraSliderLabel) continue;

        const match = loraMatches[i];
        if (match && match[1] && match[2]) {
            const loraName = match[1];
            const weight = parseFloat(match[2]);
            
            // Update values and label
            loraSlider.value = weight;
            numberInput.value = weight;
            loraSliderLabel.textContent = `Lora ${sliderIndex}: ${loraName}`;

            // Enable the sliders
            loraSlider.disabled = false;
            numberInput.disabled = false;
        } else {
            // If no Lora is found for this index, reset and disable
            loraSliderLabel.textContent = `Lora ${sliderIndex}: N/A`;
            
            // Disable the sliders
            loraSlider.disabled = true;
            numberInput.disabled = true;
        }
    }
}
// --- MODIFICATION END ---

/**
 * [SLIDER -> PROMPT]
 * Updates the weight of the N-th Lora in the prompt based on the corresponding slider's value.
 * @param {string} tabname - "txt2img" or "img2img"
 * @param {number} sliderIndex - The 0-based index of the slider/Lora to update.
 */
function updatePromptFromLoraSlider(tabname, sliderIndex) {
    const promptTextarea = gradioApp().querySelector(`#${tabname}_prompt textarea`);
    const loraSlider = gradioApp().querySelector(`#${tabname}_lora_weights_slider_${sliderIndex + 1} input[type=range]`);

    if (!promptTextarea || !loraSlider) return;

    const newWeight = parseFloat(loraSlider.value).toFixed(2);
    let matchIndex = 0;

    // Use a replacer function to only replace the N-th occurrence
    promptTextarea.value = promptTextarea.value.replace(LORA_REGEX, (match, loraName, loraWeight) => {
        if (matchIndex === sliderIndex) {
            matchIndex++;
            return `<lora:${loraName}:${newWeight}>`;
        }
        matchIndex++;
        return match;
    });
        
    isLoraSliderUpdate = true;
    promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
}


/**
 * A combined handler for when the user types in the prompt.
 */
function onPromptInput(tabname) {
    if (isLoraSliderUpdate) {
        isLoraSliderUpdate = false;
    } else {
        watchPrompts(tabname);
    }
    
    updateLoraSliderFromPrompt(tabname);
}


function init() {
    txt2img_prompt.addEventListener("input", () => onPromptInput(TEXT_TO_IMAGE));
    txt2img_neg_prompt.addEventListener("input", () => watchPrompts(TEXT_TO_IMAGE)); 
    img2img_prompt.addEventListener("input", () => onPromptInput(IMAGE_TO_IMAGE));
    img2img_neg_prompt.addEventListener("input", () => watchPrompts(IMAGE_TO_IMAGE));

    txt2img_clear_prompt.addEventListener("click", () => deletePrompts(TEXT_TO_IMAGE));
    img2img_clear_prompt.addEventListener("click", () => deletePrompts(IMAGE_TO_IMAGE))

    // Add event listeners for all Lora sliders
    for (let i = 0; i < NUM_LORA_SLIDERS; i++) {
        const txt2img_lora_slider = gradioApp().querySelector(`#txt2img_lora_weights_slider_${i+1} input[type=range]`);
        const img2img_lora_slider = gradioApp().querySelector(`#img2img_lora_weights_slider_${i+1} input[type=range]`);

        if(txt2img_lora_slider) {
            // We use a closure to correctly capture the index 'i' for the event listener
            txt2img_lora_slider.addEventListener("input", ((index) => () => updatePromptFromLoraSlider(TEXT_TO_IMAGE, index))(i));
        }
        if(img2img_lora_slider) {
            img2img_lora_slider.addEventListener("input", ((index) => () => updatePromptFromLoraSlider(IMAGE_TO_IMAGE, index))(i));
        }
    }
    
    if (!window.localStorage.getItem(HISTORY_KEY)) {
        _initPromptHistory();
    }
}

// --- MODIFICATION START ---
function moveHistorySlidersUnderPrompts() {
    const txt2img_toprow = document.getElementById(TEXT_TO_IMAGE+"_toprow");
    const img2img_toprow = document.getElementById(IMAGE_TO_IMAGE+"_toprow");
    
    // Move History Row
    txt2img_toprow.after(document.getElementById(TEXT_TO_IMAGE+"_history_top_row"));
    img2img_toprow.after(document.getElementById(IMAGE_TO_IMAGE+"_history_top_row"));
    
    // Move the single Lora row
    document.getElementById(TEXT_TO_IMAGE+"_history_top_row").after(document.getElementById(TEXT_TO_IMAGE+"_lora_weights_row"));
    document.getElementById(IMAGE_TO_IMAGE+"_history_top_row").after(document.getElementById(IMAGE_TO_IMAGE+"_lora_weights_row"));
}
// --- MODIFICATION END ---

function watchPrompts(tabname) {
    _increaseSlider(tabname);
    _storeHistory(tabname);
}

function deletePrompts(tabname) {
    let history = _loadHistory();
    _increaseSlider(tabname);
    history[tabname].push(_emptyPrompt())

    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));    
    load_history(tabname);
}

// Webui methods.
function update_prompt_history(tabname) {
    const slider = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider> input"
    );
    const prompt = gradioApp().querySelector("#" + tabname + "_prompt textarea");
    const negprompt = gradioApp().querySelector(
        "#" + tabname + "_neg_prompt textarea"
    );

    const value = JSON.parse(window.localStorage.getItem(HISTORY_KEY))[tabname][slider.value - 1];

    prompt.value = value[PROMPT_KEY];
    negprompt.value = value[NEGATIVE_PROMPT_KEY];
    
    updateLoraSliderFromPrompt(tabname);
}

function load_history(tabname) {
    const slider = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider> input"
    );
    const input = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider > div > input"
    );

    let history = JSON.parse(window.localStorage.getItem(HISTORY_KEY));

    last_prompt = history[tabname][history[tabname].length - 1][PROMPT_KEY];
    last_neg_prompt = history[tabname][history[tabname].length - 1][NEGATIVE_PROMPT_KEY];

    slider.max = parseInt(history[tabname].length);
    slider.value = parseInt(history[tabname].length);
    input.value = parseInt(history[tabname].length);

    gradioApp().querySelector("#" + tabname + "_prompt textarea").value = last_prompt;
    gradioApp().querySelector("#" + tabname + "_neg_prompt textarea").value = last_neg_prompt;

    updateLoraSliderFromPrompt(tabname);
}

function confirm_clear_history(tabname) {
    const slider = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider> input"
    );
    const input = gradioApp().querySelector(
        "#" + tabname + "_prompt_history_slider> div input"
    );

    if (confirm("Clear " + tabname + " prompt history?")) {
        slider.max = 1;
        slider.value = 1;
        input.value = 1;
    
        _initPromptHistory();
    }
}

// Callbacks
onUiLoaded(async () => {
    init();
    moveHistorySlidersUnderPrompts();
});