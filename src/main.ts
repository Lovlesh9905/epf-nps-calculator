import { updateUIDashboard, toggleAccordion } from './ui';
import { DeductionsInput } from './taxEngine';

// Application State
let currentCTC = 3600000;
let currentSelectedOption = 3; // Default option for breakdown view (Option 3)
let activeRegime: "new" | "old" = "new";
let performanceBonusState = 0; // Performance Bonus outside CTC

const deductionsState: DeductionsInput = {
    voluntary80c: 100000,
    voluntaryNps: 0,
    healthInsurance: 25000,
    homeLoanInterest: 0,
    monthlyRent: 0,
    otherExemptions: 0
};

// Element References
const ctcInput = document.getElementById('ctcInput') as HTMLInputElement | null;
const ctcSlider = document.getElementById('ctcSlider') as HTMLInputElement | null;
const perfBonusInput = document.getElementById('perfBonusInput') as HTMLInputElement | null;
const gratuityCheckbox = document.getElementById('gratuityInCtc') as HTMLInputElement | null;
const accordionHeader = document.getElementById('accordionHeader');
const tabs = [
    document.getElementById('tab1'),
    document.getElementById('tab2'),
    document.getElementById('tab3')
];

// Regime switch references
const regimeNewBtn = document.getElementById('regime_new');
const regimeOldBtn = document.getElementById('regime_old');
const deductionsPanel = document.getElementById('deductionsPanel');

// Deduction input references
const input80c = document.getElementById('ded_80c') as HTMLInputElement | null;
const inputRent = document.getElementById('ded_rent') as HTMLInputElement | null;
const inputNps = document.getElementById('ded_nps') as HTMLInputElement | null;
const input80d = document.getElementById('ded_80d') as HTMLInputElement | null;
const input24b = document.getElementById('ded_24b') as HTMLInputElement | null;
const inputOther = document.getElementById('ded_other') as HTMLInputElement | null;

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
    updateUIDashboard(currentCTC, currentSelectedOption, isGratuityInCTC(), activeRegime, deductionsState, performanceBonusState);
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

    // 3. Performance Bonus input event
    if (perfBonusInput) {
        perfBonusInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const val = parseFloat(target.value);
            performanceBonusState = isNaN(val) ? 0 : val;
            triggerRecalculate();
        });
    }

    // 4. Gratuity checkbox toggle event
    if (gratuityCheckbox) {
        gratuityCheckbox.addEventListener('change', () => {
            triggerRecalculate();
        });
    }

    // 5. Preset button clicks
    presets.forEach(preset => {
        const btn = document.getElementById(preset.id);
        if (btn) {
            btn.addEventListener('click', () => {
                updateCTC(preset.value);
            });
        }
    });

    // 6. Accordion Toggle
    if (accordionHeader) {
        accordionHeader.addEventListener('click', () => {
            toggleAccordion();
        });
    }

    // 7. Option tabs switching
    tabs.forEach((tab, index) => {
        if (tab) {
            tab.addEventListener('click', () => {
                selectBreakdownOption(index + 1);
            });
        }
    });

    // 8. Regime toggle clicks
    if (regimeNewBtn && regimeOldBtn) {
        regimeNewBtn.addEventListener('click', () => {
            activeRegime = "new";
            regimeNewBtn.classList.add('active');
            regimeOldBtn.classList.remove('active');
            if (deductionsPanel) deductionsPanel.classList.add('hidden');
            triggerRecalculate();
        });
        regimeOldBtn.addEventListener('click', () => {
            activeRegime = "old";
            regimeOldBtn.classList.add('active');
            regimeNewBtn.classList.remove('active');
            if (deductionsPanel) deductionsPanel.classList.remove('hidden');
            triggerRecalculate();
        });
    }

    // 9. Bind deduction inputs
    const bindDeductionInput = (el: HTMLInputElement | null, key: keyof DeductionsInput) => {
        if (el) {
            el.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const val = parseFloat(target.value);
                deductionsState[key] = isNaN(val) ? 0 : val;
                triggerRecalculate();
            });
        }
    };
    bindDeductionInput(input80c, 'voluntary80c');
    bindDeductionInput(inputRent, 'monthlyRent');
    bindDeductionInput(inputNps, 'voluntaryNps');
    bindDeductionInput(input80d, 'healthInsurance');
    bindDeductionInput(input24b, 'homeLoanInterest');
    bindDeductionInput(inputOther, 'otherExemptions');
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
