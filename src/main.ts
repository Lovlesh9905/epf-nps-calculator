import { updateUIDashboard, toggleAccordion } from './ui';

// Application State
let currentCTC = 3600000;
let currentSelectedOption = 3; // Default option for breakdown view (Option 3)

// Element References
const ctcInput = document.getElementById('ctcInput') as HTMLInputElement | null;
const ctcSlider = document.getElementById('ctcSlider') as HTMLInputElement | null;
const gratuityCheckbox = document.getElementById('gratuityInCtc') as HTMLInputElement | null;
const accordionHeader = document.getElementById('accordionHeader');
const tabs = [
    document.getElementById('tab1'),
    document.getElementById('tab2'),
    document.getElementById('tab3')
];

// Presets mapping
const presets = [
    { id: 'btn_preset_6l', value: 600000 },
    { id: 'btn_preset_12l', value: 1200000 },
    { id: 'btn_preset_18l', value: 1800000 },
    { id: 'btn_preset_24l', value: 2400000 },
    { id: 'btn_preset_36l', value: 3600000 },
    { id: 'btn_preset_50l', value: 5000000 }
];

// Helper to retrieve gratuity checkbox state
function isGratuityInCTC(): boolean {
    return gratuityCheckbox ? gratuityCheckbox.checked : true;
}

// Synchronize inputs and trigger recalculation
function updateCTC(val: number): void {
    currentCTC = val;

    if (ctcInput && parseFloat(ctcInput.value) !== val) {
        ctcInput.value = val.toString();
    }

    if (ctcSlider) {
        const minVal = parseFloat(ctcSlider.min);
        const maxVal = parseFloat(ctcSlider.max);
        if (val >= minVal && val <= maxVal) {
            ctcSlider.value = val.toString();
        }
    }

    triggerRecalculate();
}

// Recalculate and update the screen
function triggerRecalculate(): void {
    updateUIDashboard(currentCTC, currentSelectedOption, isGratuityInCTC());
}

// Select breakdown tab option
function selectBreakdownOption(optIndex: number): void {
    currentSelectedOption = optIndex;
    
    // Update active visual state for tabs
    tabs.forEach((tab, index) => {
        if (tab) {
            tab.classList.toggle('active', (index + 1) === optIndex);
        }
    });

    triggerRecalculate();
}

// Bind Event Listeners
function initEventListeners(): void {
    // 1. Text input events
    if (ctcInput) {
        ctcInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const val = parseFloat(target.value);
            if (!isNaN(val) && val > 0) {
                updateCTC(val);
            }
        });
    }

    // 2. Slider events
    if (ctcSlider) {
        ctcSlider.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const val = parseFloat(target.value);
            if (!isNaN(val) && val > 0) {
                updateCTC(val);
            }
        });
    }

    // 3. Gratuity checkbox toggle event
    if (gratuityCheckbox) {
        gratuityCheckbox.addEventListener('change', () => {
            triggerRecalculate();
        });
    }

    // 4. Preset button clicks
    presets.forEach(preset => {
        const btn = document.getElementById(preset.id);
        if (btn) {
            btn.addEventListener('click', () => {
                updateCTC(preset.value);
            });
        }
    });

    // 5. Accordion Toggle
    if (accordionHeader) {
        accordionHeader.addEventListener('click', () => {
            toggleAccordion();
        });
    }

    // 6. Option tabs switching
    tabs.forEach((tab, index) => {
        if (tab) {
            tab.addEventListener('click', () => {
                selectBreakdownOption(index + 1);
            });
        }
    });
}

// Initial Runner
function startApp(): void {
    initEventListeners();
    triggerRecalculate();
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
