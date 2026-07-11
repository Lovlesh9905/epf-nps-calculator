import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';


import styles from './EpfNpsCalculatorWebPart.module.scss';
import * as strings from 'EpfNpsCalculatorWebPartStrings';
import { payrollEngine, PayrollResult, DeductionsInput } from './taxEngine';

export interface IEpfNpsCalculatorWebPartProps {
  description: string;
}

export default class EpfNpsCalculatorWebPart extends BaseClientSideWebPart<IEpfNpsCalculatorWebPartProps> {

  private _currentCTC: number = 3600000;
  private _currentSelectedOption: number = 3; // Default option for breakdown view (Option 3)
  private _activeRegime: "new" | "old" = "new";
  private _performanceBonusState: number = 0; // Performance Bonus outside CTC

  private _deductionsState: DeductionsInput = {
    voluntary80c: 100000,
    voluntaryNps: 0,
    healthInsurance: 25000,
    homeLoanInterest: 0,
    monthlyRent: 0,
    otherExemptions: 0
  };

  private _formatINR(amount: number): string {
    return "₹" + Math.round(amount).toLocaleString('en-IN');
  }

  private _toggleAccordion(): void {
    const panel = this.domElement.querySelector('#slabAccordion');
    if (panel) {
      panel.classList.toggle('open');
    }
  }

  private _renderTaxBreakdown(optionResult: PayrollResult): void {
    const tbody = this.domElement.querySelector('#slabBreakdownBody');
    if (!tbody) return;

    const taxRes = optionResult.taxResult;
    tbody.innerHTML = '';

    taxRes.slabDetails.forEach(slab => {
      const tr = document.createElement('tr');
      if (slab.taxableInSlab > 0) {
        tr.className = 'slab-row-active';
      }

      const rangeTd = document.createElement('td');
      rangeTd.className = 'row-header';
      rangeTd.innerText = slab.range;

      const rateTd = document.createElement('td');
      rateTd.innerText = slab.rate;

      const taxableTd = document.createElement('td');
      taxableTd.innerText = this._formatINR(slab.taxableInSlab);

      const taxTd = document.createElement('td');
      taxTd.innerText = this._formatINR(slab.taxInSlab);

      tr.appendChild(rangeTd);
      tr.appendChild(rateTd);
      tr.appendChild(taxableTd);
      tr.appendChild(taxTd);
      tbody.appendChild(tr);
    });

    // Update Summary labels
    const lblGross = this.domElement.querySelector('#lbl_gross') as HTMLElement | null;
    if (lblGross) {
      lblGross.innerText = this._formatINR(optionResult.totalGrossTaxable);
    }

    const lblSlabTax = this.domElement.querySelector('#lbl_slab_tax') as HTMLElement | null;
    if (lblSlabTax) lblSlabTax.innerText = this._formatINR(taxRes.originalSlabTax);
    
    const lblRelief = this.domElement.querySelector('#lbl_relief') as HTMLElement | null;
    if (lblRelief) {
      let reliefText = "₹0";
      if (taxRes.rebate > 0) {
        reliefText = "-" + this._formatINR(taxRes.rebate) + " (Sec 87A Rebate)";
      } else if (taxRes.marginalRelief > 0) {
        reliefText = "-" + this._formatINR(taxRes.marginalRelief) + " (Marginal Relief)";
      }
      lblRelief.innerText = reliefText;
    }

    const lblCess = this.domElement.querySelector('#lbl_cess') as HTMLElement | null;
    if (lblCess) lblCess.innerText = this._formatINR(taxRes.cess);

    const lblNetTax = this.domElement.querySelector('#lbl_net_tax') as HTMLElement | null;
    if (lblNetTax) lblNetTax.innerText = this._formatINR(optionResult.annualTax);

    // Render Deductions Breakout Table under Old Tax Regime
    const dedSection = this.domElement.querySelector('#oldRegimeDeductionsSection') as HTMLElement | null;
    const dedTbody = this.domElement.querySelector('#deductionsBreakdownBody');
    
    if (dedSection && dedTbody) {
      if (optionResult.taxRegime === "old" && optionResult.deductionsBreakdown) {
        dedSection.classList.remove('hidden');
        dedTbody.innerHTML = '';
        
        optionResult.deductionsBreakdown.forEach(row => {
          const tr = document.createElement('tr');
          if (row.allowed > 0) {
            tr.className = 'slab-row-active';
          }
          
          const sectionTd = document.createElement('td');
          sectionTd.className = 'row-header';
          sectionTd.innerText = row.section;
          
          const userTd = document.createElement('td');
          userTd.innerText = row.userInput > 0 ? this._formatINR(row.userInput) : "₹0";
          
          const ctcTd = document.createElement('td');
          ctcTd.innerText = row.ctcMatch > 0 ? this._formatINR(row.ctcMatch) : "₹0";
          
          const totalTd = document.createElement('td');
          totalTd.innerText = row.totalClaimed > 0 ? this._formatINR(row.totalClaimed) : "₹0";
          
          const limitTd = document.createElement('td');
          limitTd.innerText = row.limit;
          
          const allowedTd = document.createElement('td');
          allowedTd.innerText = row.allowed > 0 ? this._formatINR(row.allowed) : "₹0";
          
          const taxableTd = document.createElement('td');
          taxableTd.innerText = row.taxable > 0 ? this._formatINR(row.taxable) : "₹0";
          if (row.taxable > 0) {
            taxableTd.style.color = '#ef4444'; // Red for taxable remaining portion
            taxableTd.style.fontWeight = 'bold';
          }
          
          tr.appendChild(sectionTd);
          tr.appendChild(userTd);
          tr.appendChild(ctcTd);
          tr.appendChild(totalTd);
          tr.appendChild(limitTd);
          tr.appendChild(allowedTd);
          tr.appendChild(taxableTd);
          dedTbody.appendChild(tr);
        });
      } else {
        dedSection.classList.add('hidden');
      }
    }
  }

  private _updateUIDashboard(): void {
    const results: { [key: number]: PayrollResult } = {};
    const gratuityInCTC = this._isGratuityInCTC();

    // Update Table Header for Gratuity and Tax Regime dynamically
    const lblGratuityHeader = this.domElement.querySelector('#lbl_gratuity_header') as HTMLElement | null;
    if (lblGratuityHeader) {
      lblGratuityHeader.innerText = gratuityInCTC ? "Gratuity Provision (4.81%)" : "Gratuity Provision (Outside CTC)";
    }
    const lblTaxPipelineHeader = this.domElement.querySelector('#lbl_tax_pipeline_header') as HTMLElement | null;
    if (lblTaxPipelineHeader) {
      lblTaxPipelineHeader.innerText = this._activeRegime === "old" ? "D. Taxation Pipeline (Old Tax Regime Slabs)" : "D. Taxation Pipeline (New Tax Regime Slabs)";
    }
    const badgeRegime = this.domElement.querySelector('.badge-regime') as HTMLElement | null;
    if (badgeRegime) {
      badgeRegime.innerText = this._activeRegime === "old" ? "Old Tax Regime" : "FY 2026-27 | New Tax Regime";
    }
    const cardOpt3Title = this.domElement.querySelector('#card_opt3_title') as HTMLElement | null;
    if (cardOpt3Title) {
      cardOpt3Title.innerText = this._activeRegime === "old" ? "Optimised (Full EPF + 10% NPS)" : "Optimised (Full EPF + 14% NPS)";
    }
    const lblNpsHeader = this.domElement.querySelector('#lbl_nps_header') as HTMLElement | null;
    if (lblNpsHeader) {
      lblNpsHeader.innerText = this._activeRegime === "old" ? "Employer NPS Contribution (10%)" : "Employer NPS Contribution (14%)";
    }

    // Calculate for all three options
    for (let opt = 1; opt <= 3; opt++) {
      const res = payrollEngine(this._currentCTC, opt, gratuityInCTC, this._activeRegime, this._deductionsState, this._performanceBonusState);
      results[opt] = res;

      // Update Detailed Table Cell elements
      const elementsToUpdate = {
        basic: this.domElement.querySelector(`#opt${opt}_basic`) as HTMLElement | null,
        hra: this.domElement.querySelector(`#opt${opt}_hra`) as HTMLElement | null,
        bonus: this.domElement.querySelector(`#opt${opt}_bonus`) as HTMLElement | null,
        conveyance: this.domElement.querySelector(`#opt${opt}_conveyance`) as HTMLElement | null,
        er_pf: this.domElement.querySelector(`#opt${opt}_er_pf`) as HTMLElement | null,
        pf_admin: this.domElement.querySelector(`#opt${opt}_pf_admin`) as HTMLElement | null,
        edli: this.domElement.querySelector(`#opt${opt}_edli`) as HTMLElement | null,
        er_nps: this.domElement.querySelector(`#opt${opt}_er_nps`) as HTMLElement | null,
        gratuity: this.domElement.querySelector(`#opt${opt}_gratuity`) as HTMLElement | null,
        special: this.domElement.querySelector(`#opt${opt}_special`) as HTMLElement | null,
        ctc: this.domElement.querySelector(`#opt${opt}_ctc`) as HTMLElement | null,
        gross_ctc: this.domElement.querySelector(`#opt${opt}_gross_ctc`) as HTMLElement | null,
        perf_bonus_table: this.domElement.querySelector(`#opt${opt}_perf_bonus_table`) as HTMLElement | null,
        gross: this.domElement.querySelector(`#opt${opt}_gross`) as HTMLElement | null,
        applied_regime: this.domElement.querySelector(`#opt${opt}_applied_regime`) as HTMLElement | null,
        std_ded: this.domElement.querySelector(`#opt${opt}_std_ded`) as HTMLElement | null,
        deductions: this.domElement.querySelector(`#opt${opt}_deductions`) as HTMLElement | null,
        taxable_base: this.domElement.querySelector(`#opt${opt}_taxable_base`) as HTMLElement | null,
        tax_table: this.domElement.querySelector(`#opt${opt}_tax_table`) as HTMLElement | null,
        ee_pf: this.domElement.querySelector(`#opt${opt}_ee_pf`) as HTMLElement | null,
        takehome: this.domElement.querySelector(`#opt${opt}_takehome`) as HTMLElement | null,
        sum_takehome: this.domElement.querySelector(`#opt${opt}_sum_takehome`) as HTMLElement | null,
        sum_tax: this.domElement.querySelector(`#opt${opt}_sum_tax`) as HTMLElement | null,
        sum_savings: this.domElement.querySelector(`#opt${opt}_sum_savings`) as HTMLElement | null,
        sum_total: this.domElement.querySelector(`#opt${opt}_sum_total`) as HTMLElement | null
      };

      if (elementsToUpdate.basic) elementsToUpdate.basic.innerText = this._formatINR(res.basic);
      if (elementsToUpdate.hra) elementsToUpdate.hra.innerText = this._formatINR(res.hra);
      if (elementsToUpdate.bonus) elementsToUpdate.bonus.innerText = this._formatINR(res.bonus);
      if (elementsToUpdate.conveyance) elementsToUpdate.conveyance.innerText = this._formatINR(res.conveyance);
      if (elementsToUpdate.er_pf) elementsToUpdate.er_pf.innerText = this._formatINR(res.er_pf);
      if (elementsToUpdate.pf_admin) elementsToUpdate.pf_admin.innerText = this._formatINR(res.pfAdmin);
      if (elementsToUpdate.edli) elementsToUpdate.edli.innerText = this._formatINR(res.edli);
      if (elementsToUpdate.er_nps) elementsToUpdate.er_nps.innerText = this._formatINR(res.er_nps);
      if (elementsToUpdate.gratuity) elementsToUpdate.gratuity.innerText = gratuityInCTC ? this._formatINR(res.gratuity) : "₹0";
      if (elementsToUpdate.special) elementsToUpdate.special.innerText = this._formatINR(res.allowance);
      if (elementsToUpdate.ctc) elementsToUpdate.ctc.innerText = this._formatINR(this._currentCTC);
      if (elementsToUpdate.gross_ctc) elementsToUpdate.gross_ctc.innerText = this._formatINR(res.grossSalary);
      if (elementsToUpdate.perf_bonus_table) elementsToUpdate.perf_bonus_table.innerText = this._formatINR(res.performanceBonus);
      if (elementsToUpdate.gross) elementsToUpdate.gross.innerText = this._formatINR(res.totalGrossTaxable);
      
      if (elementsToUpdate.applied_regime) {
        elementsToUpdate.applied_regime.innerText = res.taxRegime === "old" ? "Old Regime" : "New Regime";
      }
      if (elementsToUpdate.std_ded) {
        elementsToUpdate.std_ded.innerText = res.taxRegime === "old" ? "-₹50,000" : "-₹75,000";
      }
      if (elementsToUpdate.deductions) {
        elementsToUpdate.deductions.innerText = res.taxRegime === "old" ? "-" + this._formatINR(res.deductionsTotal) : "₹0";
      }

      if (elementsToUpdate.taxable_base) elementsToUpdate.taxable_base.innerText = this._formatINR(res.taxableBase);
      if (elementsToUpdate.tax_table) elementsToUpdate.tax_table.innerText = this._formatINR(res.annualTax);
      if (elementsToUpdate.ee_pf) elementsToUpdate.ee_pf.innerText = this._formatINR(res.monthlyEePf * 12);
      if (elementsToUpdate.takehome) elementsToUpdate.takehome.innerText = this._formatINR(res.monthlyTakehome);

      // 2. Update dashboard cards metrics dynamically
      const cardTakehome = this.domElement.querySelector(`#card_opt${opt}_takehome`) as HTMLElement | null;
      if (cardTakehome) cardTakehome.innerText = this._formatINR(res.monthlyTakehome);

      const cardTax = this.domElement.querySelector(`#card_opt${opt}_tax`) as HTMLElement | null;
      if (cardTax) cardTax.innerText = this._formatINR(res.annualTax);

      const cardSavings = this.domElement.querySelector(`#card_opt${opt}_savings`) as HTMLElement | null;
      if (cardSavings) cardSavings.innerText = this._formatINR(res.totalSavings);

      // 3. Update split visualization charts
      const totalAmount = res.monthlyTakehome * 12 + res.annualTax + res.totalSavings;
      const takehomePct = Math.round(((res.monthlyTakehome * 12) / totalAmount) * 100);
      const taxPct = Math.round((res.annualTax / totalAmount) * 100);
      const savingsPct = 100 - takehomePct - taxPct; // ensures it sums to exactly 100%

      const barTakehome = this.domElement.querySelector(`#bar_opt${opt}_takehome`) as HTMLElement | null;
      if (barTakehome) barTakehome.style.width = takehomePct + "%";

      const barTax = this.domElement.querySelector(`#bar_opt${opt}_tax`) as HTMLElement | null;
      if (barTax) barTax.style.width = taxPct + "%";

      const barSavings = this.domElement.querySelector(`#bar_opt${opt}_savings`) as HTMLElement | null;
      if (barSavings) barSavings.style.width = savingsPct + "%";

      const pctTakehome = this.domElement.querySelector(`#pct_opt${opt}_takehome`) as HTMLElement | null;
      if (pctTakehome) pctTakehome.innerText = takehomePct + "%";

      const pctTax = this.domElement.querySelector(`#pct_opt${opt}_tax`) as HTMLElement | null;
      if (pctTax) pctTax.innerText = taxPct + "%";

      const pctSavings = this.domElement.querySelector(`#pct_opt${opt}_savings`) as HTMLElement | null;
      if (pctSavings) pctSavings.innerText = savingsPct + "%";

      const annualTakehome = res.monthlyTakehome * 12 + res.performanceBonus;
      const totalOutlay = annualTakehome + res.annualTax + res.totalSavings + res.pfAdmin;

      if (elementsToUpdate.sum_takehome) elementsToUpdate.sum_takehome.innerText = this._formatINR(annualTakehome);
      if (elementsToUpdate.sum_tax) elementsToUpdate.sum_tax.innerText = this._formatINR(res.annualTax);
      if (elementsToUpdate.sum_savings) elementsToUpdate.sum_savings.innerText = this._formatINR(res.totalSavings);
      if (elementsToUpdate.sum_total) elementsToUpdate.sum_total.innerText = this._formatINR(totalOutlay);
    }

    // 4. Render Selected Detailed Tax Slab Breakdown
    this._renderTaxBreakdown(results[this._currentSelectedOption]);
  }

  private _isGratuityInCTC(): boolean {
    const gratuityCheckbox = this.domElement.querySelector('#gratuityInCtc') as HTMLInputElement | null;
    return gratuityCheckbox ? gratuityCheckbox.checked : true;
  }

  private _updateCTC(val: number): void {
    this._currentCTC = val;

    const ctcInput = this.domElement.querySelector('#ctcInput') as HTMLInputElement | null;
    if (ctcInput && parseFloat(ctcInput.value) !== val) {
      ctcInput.value = val.toString();
    }

    const ctcSlider = this.domElement.querySelector('#ctcSlider') as HTMLInputElement | null;
    if (ctcSlider) {
      const minVal = parseFloat(ctcSlider.min);
      const maxVal = parseFloat(ctcSlider.max);
      if (val >= minVal && val <= maxVal) {
        ctcSlider.value = val.toString();
      }
    }

    this._updateUIDashboard();
  }

  private _selectBreakdownOption(optIndex: number): void {
    this._currentSelectedOption = optIndex;
    
    // Update active visual state for tabs
    for (let i = 1; i <= 3; i++) {
      const tab = this.domElement.querySelector(`#tab${i}`);
      if (tab) {
        tab.classList.toggle('active', i === optIndex);
      }
    }

    this._updateUIDashboard();
  }

  private _initEventListeners(): void {
    // 1. Text input events
    const ctcInput = this.domElement.querySelector('#ctcInput') as HTMLInputElement | null;
    if (ctcInput) {
      ctcInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const val = parseFloat(target.value);
        if (!isNaN(val) && val > 0) {
          this._updateCTC(val);
        }
      });
    }

    // 2. Slider events
    const ctcSlider = this.domElement.querySelector('#ctcSlider') as HTMLInputElement | null;
    if (ctcSlider) {
      ctcSlider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const val = parseFloat(target.value);
        if (!isNaN(val) && val > 0) {
          this._updateCTC(val);
        }
      });
    }

    // 3. Performance Bonus input event
    const perfBonusInput = this.domElement.querySelector('#perfBonusInput') as HTMLInputElement | null;
    if (perfBonusInput) {
      perfBonusInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const val = parseFloat(target.value);
        this._performanceBonusState = isNaN(val) ? 0 : val;
        this._updateUIDashboard();
      });
    }

    // 4. Gratuity checkbox toggle event
    const gratuityCheckbox = this.domElement.querySelector('#gratuityInCtc') as HTMLInputElement | null;
    if (gratuityCheckbox) {
      gratuityCheckbox.addEventListener('change', () => {
        this._updateUIDashboard();
      });
    }

    // 5. Preset button clicks
    const presets = [
      { id: 'btn_preset_6l', value: 600000 },
      { id: 'btn_preset_12l', value: 1200000 },
      { id: 'btn_preset_18l', value: 1800000 },
      { id: 'btn_preset_24l', value: 2400000 },
      { id: 'btn_preset_36l', value: 3600000 },
      { id: 'btn_preset_50l', value: 5000000 }
    ];
    presets.forEach(preset => {
      const btn = this.domElement.querySelector(`#${preset.id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this._updateCTC(preset.value);
        });
      }
    });

    // 6. Accordion Toggle
    const accordionHeader = this.domElement.querySelector('#accordionHeader');
    if (accordionHeader) {
      accordionHeader.addEventListener('click', () => {
        this._toggleAccordion();
      });
    }

    // 7. Option tabs switching
    for (let i = 1; i <= 3; i++) {
      const tab = this.domElement.querySelector(`#tab${i}`);
      if (tab) {
        tab.addEventListener('click', () => {
          this._selectBreakdownOption(i);
        });
      }
    }

    // 8. Regime toggle clicks
    const regimeNewBtn = this.domElement.querySelector('#regime_new');
    const regimeOldBtn = this.domElement.querySelector('#regime_old');
    const deductionsPanel = this.domElement.querySelector('#deductionsPanel');
    if (regimeNewBtn && regimeOldBtn) {
      regimeNewBtn.addEventListener('click', () => {
        this._activeRegime = "new";
        regimeNewBtn.classList.add('active');
        regimeOldBtn.classList.remove('active');
        if (deductionsPanel) deductionsPanel.classList.add('hidden');
        this._updateUIDashboard();
      });
      regimeOldBtn.addEventListener('click', () => {
        this._activeRegime = "old";
        regimeOldBtn.classList.add('active');
        regimeNewBtn.classList.remove('active');
        if (deductionsPanel) deductionsPanel.classList.remove('hidden');
        this._updateUIDashboard();
      });
    }

    // 9. Bind deduction inputs
    const bindDeductionInput = (id: string, key: keyof DeductionsInput): void => {
      const el = this.domElement.querySelector(`#${id}`) as HTMLInputElement | null;
      if (el) {
        el.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          const val = parseFloat(target.value);
          this._deductionsState[key] = isNaN(val) ? 0 : val;
          this._updateUIDashboard();
        });
      }
    };
    bindDeductionInput('ded_80c', 'voluntary80c');
    bindDeductionInput('ded_rent', 'monthlyRent');
    bindDeductionInput('ded_nps', 'voluntaryNps');
    bindDeductionInput('ded_80d', 'healthInsurance');
    bindDeductionInput('ded_24b', 'homeLoanInterest');
    bindDeductionInput('ded_other', 'otherExemptions');
  }

  public render(): void {
    if (styles) { /* no-op to satisfy compile check */ }
    this.domElement.innerHTML = `
    <div class="epfNpsCalculator">
      <div class="container">
        <header>
            <h1>Dynamic CTC Restructuring Dashboard</h1>
            <p>Optimize Income Tax & Build Wealth under the New Wage Code Standards</p>
            <span class="badge-regime">FY 2026-27 | New Tax Regime</span>
        </header>

        <div class="workspace-grid">
            <!-- Input Panel -->
            <div class="glass-card">
                <div class="input-panel">
                    <!-- Tax Regime Selector Segmented Control -->
                    <div class="regime-selector-wrapper">
                        <span style="font-size: 0.9rem; font-weight: 600; color: var(--color-text-secondary);">Tax Regime Selection</span>
                        <div class="segmented-control">
                            <button class="control-btn active" id="regime_new">New Regime (FY 2026-27)</button>
                            <button class="control-btn" id="regime_old">Old Regime</button>
                        </div>
                    </div>

                    <div class="input-header">
                        <h2>Enter Annual CTC</h2>
                        <div class="presets-wrapper">
                            <button class="preset-btn" id="btn_preset_6l">₹6L</button>
                            <button class="preset-btn" id="btn_preset_12l">₹12L</button>
                            <button class="preset-btn" id="btn_preset_18l">₹18L</button>
                            <button class="preset-btn" id="btn_preset_24l">₹24L</button>
                            <button class="preset-btn" id="btn_preset_36l">₹36L</button>
                            <button class="preset-btn" id="btn_preset_50l">₹50L</button>
                        </div>
                    </div>
                    
                    <div class="input-wrapper">
                        <span class="currency-symbol">₹</span>
                        <input type="number" id="ctcInput" value="3600000" min="100000" max="100000000" step="50000">
                    </div>

                    <div class="slider-wrapper">
                        <input type="range" id="ctcSlider" min="300000" max="6000000" step="50000" value="3600000">
                        <div class="slider-labels">
                            <span>₹3L</span>
                            <span>₹15L</span>
                            <span>₹30L</span>
                            <span>₹45L</span>
                            <span>₹60L+</span>
                        </div>
                    </div>

                    <!-- Performance Bonus (Outside CTC) Input -->
                    <div style="margin-top: 15px; margin-bottom: 15px;">
                        <label style="font-size: 0.9rem; font-weight: 600; color: var(--color-text-secondary); display: block; margin-bottom: 5px;">
                            Performance Bonus (Outside CTC)
                        </label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol" style="left: 12px; color: var(--color-text-secondary); font-weight: 600;">₹</span>
                            <input type="number" id="perfBonusInput" value="0" min="0" max="5000000" step="10000" 
                                   style="padding: 10px 12px 10px 30px; font-size: 1.1rem; border-radius: 8px; background: #0f172a; border: 1px solid var(--border-card); color: var(--color-text-primary); outline: none; width: 100%;">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">This is added on top of the CTC for tax calculations (kept at ₹0 by default).</span>
                    </div>

                    <!-- Gratuity Option Toggle -->
                    <div class="gratuity-toggle-wrapper">
                        <label class="toggle-switch">
                            <input type="checkbox" id="gratuityInCtc" checked>
                            <span class="toggle-slider"></span>
                        </label>
                        <span class="gratuity-toggle-label">Include Gratuity in CTC (Deduct 4.81% Basic provision from CTC basket)</span>
                    </div>
                </div>
            </div>

            <!-- Old Regime Deductions Panel (Hidden by default) -->
            <div class="glass-card hidden" id="deductionsPanel">
                <h2 style="font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; margin-bottom: 5px;">
                     Old Regime Exemptions & Deductions
                </h2>
                <p style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 15px;">
                    Configure tax-saving investments to see if the Old Regime yields a higher take-home salary.
                </p>
                <div class="deductions-grid">
                    <div class="deduction-item">
                        <label>Voluntary 80C (PPF, ELSS, etc.)</label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol">₹</span>
                            <input type="number" id="ded_80c" value="100000" min="0" max="150000" step="5000">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">Employee EPF is automatically added to this (total capped at ₹1.5 Lakhs).</span>
                    </div>
                    
                    <div class="deduction-item">
                        <label>Monthly Rent Paid (HRA Exemption)</label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol">₹</span>
                            <input type="number" id="ded_rent" value="0" min="0" max="1000000" step="1000">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">HRA exemption calculates as Rent minus 10% of Basic (capped at HRA).</span>
                    </div>

                    <div class="deduction-item">
                        <label>Voluntary NPS (Sec 80CCD(1B))</label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol">₹</span>
                            <input type="number" id="ded_nps" value="0" min="0" max="50000" step="5000">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">Deduction for personal contribution to NPS (capped at ₹50,000).</span>
                    </div>

                    <div class="deduction-item">
                        <label>Health Insurance Premium (Sec 80D)</label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol">₹</span>
                            <input type="number" id="ded_80d" value="25000" min="0" max="100000" step="5000">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">Includes premium for self, family, and senior citizen parents.</span>
                    </div>

                    <div class="deduction-item">
                        <label>Home Loan Interest (Sec 24b)</label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol">₹</span>
                            <input type="number" id="ded_24b" value="0" min="0" max="200000" step="10000">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">Deduction on home loan interest for self-occupied property (max ₹2 Lakhs).</span>
                    </div>

                    <div class="deduction-item">
                        <label>Other Exemptions (LTA, Books, etc.)</label>
                        <div class="deduction-input-wrapper">
                            <span class="currency-symbol">₹</span>
                            <input type="number" id="ded_other" value="0" min="0" max="1000000" step="5000">
                        </div>
                        <span style="font-size: 0.75rem; color: var(--color-text-muted);">Any other tax-free allowances/exemptions.</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Comparative Dashboard Cards -->
        <div class="dashboard-cards">
            
            <!-- Option 1: Minimalist -->
            <div class="option-card" id="card_opt1">
                <div class="option-badge">Option 1</div>
                <div class="option-title">Minimalist (15K EPF Cap)</div>
                
                <div class="takehome-box">
                    <div class="takehome-label">Net In-Hand / Month</div>
                    <div class="takehome-value" id="card_opt1_takehome">₹0</div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div class="metric-row">
                        <span class="metric-label">Annual Income Tax</span>
                        <span class="metric-value tax" id="card_opt1_tax">₹0</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Annual Wealth Built</span>
                        <span class="metric-value savings" id="card_opt1_savings">₹0</span>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="chart-bar">
                        <div class="chart-bar-inner">
                            <div class="chart-segment takehome" id="bar_opt1_takehome" style="width: 60%"></div>
                            <div class="chart-segment tax" id="bar_opt1_tax" style="width: 20%"></div>
                            <div class="chart-segment savings" id="bar_opt1_savings" style="width: 20%"></div>
                        </div>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item"><span class="legend-color takehome"></span>In-Hand (<span id="pct_opt1_takehome">0%</span>)</div>
                        <div class="legend-item"><span class="legend-color tax"></span>Tax (<span id="pct_opt1_tax">0%</span>)</div>
                        <div class="legend-item"><span class="legend-color savings"></span>Retirals (<span id="pct_opt1_savings">0%</span>)</div>
                    </div>
                </div>
            </div>

            <!-- Option 2: Traditional -->
            <div class="option-card" id="card_opt2">
                <div class="option-badge">Option 2</div>
                <div class="option-title">Traditional (12% Full EPF)</div>
                
                <div class="takehome-box">
                    <div class="takehome-label">Net In-Hand / Month</div>
                    <div class="takehome-value" id="card_opt2_takehome">₹0</div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div class="metric-row">
                        <span class="metric-label">Annual Income Tax</span>
                        <span class="metric-value tax" id="card_opt2_tax">₹0</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Annual Wealth Built</span>
                        <span class="metric-value savings" id="card_opt2_savings">₹0</span>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="chart-bar">
                        <div class="chart-bar-inner">
                            <div class="chart-segment takehome" id="bar_opt2_takehome" style="width: 60%"></div>
                            <div class="chart-segment tax" id="bar_opt2_tax" style="width: 20%"></div>
                            <div class="chart-segment savings" id="bar_opt2_savings" style="width: 20%"></div>
                        </div>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item"><span class="legend-color takehome"></span>In-Hand (<span id="pct_opt2_takehome">0%</span>)</div>
                        <div class="legend-item"><span class="legend-color tax"></span>Tax (<span id="pct_opt2_tax">0%</span>)</div>
                        <div class="legend-item"><span class="legend-color savings"></span>Retirals (<span id="pct_opt2_savings">0%</span>)</div>
                    </div>
                </div>
            </div>

            <!-- Option 3: Optimised -->
            <div class="option-card recommended" id="card_opt3">
                <div class="option-badge">Option 3</div>
                <div class="option-title" id="card_opt3_title">Optimised (Full EPF + 14% NPS)</div>
                
                <div class="takehome-box">
                    <div class="takehome-label">Net In-Hand / Month</div>
                    <div class="takehome-value" id="card_opt3_takehome">₹0</div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div class="metric-row">
                        <span class="metric-label">Annual Income Tax</span>
                        <span class="metric-value tax" id="card_opt3_tax">₹0</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Annual Wealth Built</span>
                        <span class="metric-value savings" id="card_opt3_savings">₹0</span>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="chart-bar">
                        <div class="chart-bar-inner">
                            <div class="chart-segment takehome" id="bar_opt3_takehome" style="width: 60%"></div>
                            <div class="chart-segment tax" id="bar_opt3_tax" style="width: 20%"></div>
                            <div class="chart-segment savings" id="bar_opt3_savings" style="width: 20%"></div>
                        </div>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item"><span class="legend-color takehome"></span>In-Hand (<span id="pct_opt3_takehome">0%</span>)</div>
                        <div class="legend-item"><span class="legend-color tax"></span>Tax (<span id="pct_opt3_tax">0%</span>)</div>
                        <div class="legend-item"><span class="legend-color savings"></span>Retirals (<span id="pct_opt3_savings">0%</span>)</div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Interactive Slab Tax Calculator Accordion -->
        <div class="accordion-panel" id="slabAccordion">
            <div class="accordion-header" id="accordionHeader">
                <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#2563eb;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>
                    Detailed Income Tax Slab Breakdown (FY 2026-27)
                </h3>
                <span class="accordion-icon" id="accordionIcon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="option-selector">
                    <div class="option-tab active" id="tab1">Option 1 Breakdown</div>
                    <div class="option-tab" id="tab2">Option 2 Breakdown</div>
                    <div class="option-tab" id="tab3">Option 3 Breakdown</div>
                </div>
                
                <table class="slab-table">
                    <thead>
                        <tr>
                            <th class="row-header">Income Slab (New Regime)</th>
                            <th>Tax Rate</th>
                            <th>Taxable Income in Slab</th>
                            <th>Calculated Tax</th>
                        </tr>
                    </thead>
                    <tbody id="slabBreakdownBody">
                        <!-- Dynamic rendering -->
                    </tbody>
                </table>

                <div class="tax-summary-box">
                    <div class="summary-item">
                        <span class="summary-label">Gross Taxable income</span>
                        <span class="summary-value" id="lbl_gross">₹0</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Slab Tax (Before Relief)</span>
                        <span class="summary-value" id="lbl_slab_tax">₹0</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Sec 87A Rebate / Relief</span>
                        <span class="summary-value relief" id="lbl_relief">₹0</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">4% Cess</span>
                        <span class="summary-value" id="lbl_cess">₹0</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Net Tax Payable</span>
                        <span class="summary-value tax" id="lbl_net_tax">₹0</span>
                    </div>
                </div>

                <!-- Old Regime Exemptions & Deductions Breakout (Visible only under Old Tax Regime) -->
                <div id="oldRegimeDeductionsSection" style="margin-top: 30px;" class="hidden">
                    <h3 style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; color: var(--color-text-primary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#fbbf24;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Old Tax Regime Exemptions & Deductions Breakdown
                    </h3>
                    <table class="slab-table">
                        <thead>
                            <tr>
                                <th class="row-header">Deduction / Section</th>
                                <th>Declared (User)</th>
                                <th>CTC Match</th>
                                <th>Total Claimed</th>
                                <th>IT Act Limit</th>
                                <th>Allowed Deduction</th>
                                <th>Remaining Taxable</th>
                            </tr>
                        </thead>
                        <tbody id="deductionsBreakdownBody">
                            <!-- Dynamically generated rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Detailed Breakdown Table -->
        <div class="glass-card table-section">
            <h2 class="table-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#10b981;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                Comprehensive Compensation Restructuring Details
            </h2>
            <table>
                <thead>
                    <tr>
                        <th class="row-header">Salary Component (Annualized)</th>
                        <th>Option 1: Minimalist</th>
                        <th>Option 2: Traditional</th>
                        <th>Option 3: Optimised</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="section-title"><td colspan="4">A. Fixed Compensation Components</td></tr>
                    <tr>
                        <td class="row-header">
                            Basic Salary
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Set to exactly 50% of CTC to fully comply with the New Wage Code.</span>
                            </div>
                        </td>
                        <td id="opt1_basic">₹0</td><td id="opt2_basic">₹0</td><td id="opt3_basic">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            House Rent Allowance (HRA)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">HRA is fixed at 40% of Basic Salary. Note: HRA exemptions are generally not available under the New Tax Regime, but it remains a structured allowance.</span>
                            </div>
                        </td>
                        <td id="opt1_hra">₹0</td><td id="opt2_hra">₹0</td><td id="opt3_hra">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            Annual Bonus (8.333% of Basic)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Statutory / contract bonus calculated at 8.333% of Basic Salary (equivalent to exactly 1 month of Basic Salary). Deducted from Special Allowance to keep CTC neutral.</span>
                            </div>
                        </td>
                        <td id="opt1_bonus">₹0</td><td id="opt2_bonus">₹0</td><td id="opt3_bonus">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            Conveyance Allowance
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Fixed travel/commute allowance structured at ₹19,200 per annum (₹1,600/month). Deducted from Special Allowance to keep CTC neutral.</span>
                            </div>
                        </td>
                        <td id="opt1_conveyance">₹0</td><td id="opt2_conveyance">₹0</td><td id="opt3_conveyance">₹0</td>
                    </tr>
                    
                    <tr class="section-title"><td colspan="4">B. Retirals & Institutional Allocations (Pre-Tax)</td></tr>
                    <tr>
                        <td class="row-header">
                            Employer EPF Contribution (12%)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Company share of EPF. Option 1 caps the calculation at ₹15,000 monthly basic (₹21,600/yr). Option 2 and 3 calculate 12% on full basic.</span>
                            </div>
                        </td>
                        <td id="opt1_er_pf">₹0</td><td id="opt2_er_pf">₹0</td><td id="opt3_er_pf">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            PF Admin Charges (0.5%)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">EPFO administrative charge of 0.5% paid by the employer (capped or uncapped based on option EPF rules). Deducted from Special Allowance to keep CTC neutral.</span>
                            </div>
                        </td>
                        <td id="opt1_pf_admin">₹0</td><td id="opt2_pf_admin">₹0</td><td id="opt3_pf_admin">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            EDLI Contribution (0.5%)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Employees' Deposit Linked Insurance scheme contribution of 0.5% paid by the employer, capped at a ₹15,000 monthly basic wage ceiling (max ₹900/year). Deducted from Special Allowance to keep CTC neutral.</span>
                            </div>
                        </td>
                        <td id="opt1_edli">₹0</td><td id="opt2_edli">₹0</td><td id="opt3_edli">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            <span id="lbl_nps_header">Employer NPS Contribution (14%)</span>
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Exempt under Section 80CCD(2) up to 14% of Basic under the New Tax Regime (10% under Old Regime). Maximized in Option 3.</span>
                            </div>
                        </td>
                        <td id="opt1_er_nps">₹0</td><td id="opt2_er_nps">₹0</td><td id="opt3_er_nps">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            <span id="lbl_gratuity_header">Gratuity Provision (4.81%)</span>
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Calculated at 4.81% of Basic as a statutory accrual representing retirement benefits. Shows as ₹0 here if excluded from CTC.</span>
                            </div>
                        </td>
                        <td id="opt1_gratuity">₹0</td><td id="opt2_gratuity">₹0</td><td id="opt3_gratuity">₹0</td>
                    </tr>

                    <tr class="section-title"><td colspan="4">C. Balancing Basket Component</td></tr>
                    <tr>
                        <td class="row-header">
                            Special / Flexi Allowance
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Balancing figure to maintain absolute CTC neutrality: Special Allowance = CTC - (Basic + HRA + Employer EPF + Employer NPS + Gratuity).</span>
                            </div>
                        </td>
                        <td id="opt1_special">₹0</td><td id="opt2_special">₹0</td><td id="opt3_special">₹0</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.03); font-weight: bold;">
                        <td class="row-header">TOTAL LOCKED ANNUAL CTC (A+B+C)</td>
                        <td id="opt1_ctc">₹0</td><td id="opt2_ctc">₹0</td><td id="opt3_ctc">₹0</td>
                    </tr>

                    <tr class="section-title"><td colspan="4" id="lbl_tax_pipeline_header">D. Taxation Pipeline (New Tax Regime Slabs)</td></tr>
                    <tr>
                        <td class="row-header">
                            Gross Salary from CTC Basket
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Gross salary derived from fixed CTC components (Basic + HRA + Special Allowance + Bonus + Conveyance).</span>
                            </div>
                        </td>
                        <td id="opt1_gross_ctc">₹0</td><td id="opt2_gross_ctc">₹0</td><td id="opt3_gross_ctc">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            Performance Bonus (Outside CTC)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Additional variable performance bonus paid on top of the base CTC.</span>
                            </div>
                        </td>
                        <td id="opt1_perf_bonus_table">₹0</td><td id="opt2_perf_bonus_table">₹0</td><td id="opt3_perf_bonus_table">₹0</td>
                    </tr>
                    <tr style="font-weight: bold; background: rgba(255,255,255,0.02);">
                        <td class="row-header">Total Gross Taxable Salary</td>
                        <td id="opt1_gross">₹0</td><td id="opt2_gross">₹0</td><td id="opt3_gross">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">Tax Regime Applied</td>
                        <td id="opt1_applied_regime">New Regime</td><td id="opt2_applied_regime">New Regime</td><td id="opt3_applied_regime">New Regime</td>
                    </tr>
                    <tr>
                        <td class="row-header">Standard Deduction</td>
                        <td id="opt1_std_ded">-₹75,000</td><td id="opt2_std_ded">-₹75,000</td><td id="opt3_std_ded">-₹75,000</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            Tax Exemptions & Deductions
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Total deductions claimed under the Old Regime (80C, HRA, 80D, 24b, etc.). Always ₹0 under the New Tax Regime.</span>
                            </div>
                        </td>
                        <td id="opt1_deductions">-₹0</td><td id="opt2_deductions">-₹0</td><td id="opt3_deductions">-₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">Net Taxable Income Base</td>
                        <td id="opt1_taxable_base">₹0</td><td id="opt2_taxable_base">₹0</td><td id="opt3_taxable_base">₹0</td>
                    </tr>
                    <tr style="color: var(--color-tax); font-weight: bold;">
                        <td class="row-header">TOTAL ANNUAL TAX PAYABLE (with 4% Cess)</td>
                        <td id="opt1_tax_table">₹0</td><td id="opt2_tax_table">₹0</td><td id="opt3_tax_table">₹0</td>
                    </tr>

                    <tr class="section-title"><td colspan="4">E. Monthly Net Liquidity (Monthly Deliverables)</td></tr>
                    <tr>
                        <td class="row-header">
                            Employee Monthly EPF Deduction
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">The employee's matching monthly EPF deduction (12% of basic, capped or uncapped depending on option choice).</span>
                            </div>
                        </td>
                        <td id="opt1_ee_pf">₹0</td><td id="opt2_ee_pf">₹0</td><td id="opt3_ee_pf">₹0</td>
                    </tr>
                    <tr class="highlight">
                        <td class="row-header">NET MONTHLY TAKE-HOME (In-Hand Cash)</td>
                        <td id="opt1_takehome">₹0</td><td id="opt2_takehome">₹0</td><td id="opt3_takehome">₹0</td>
                    </tr>
                    
                    <tr class="section-title"><td colspan="4">F. Annualized CTC Allocation Summary</td></tr>
                    <tr>
                        <td class="row-header">
                            Annual Take-Home Cash (In-Hand)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Total annual take-home salary paid in cash (Gross Salary minus Income Tax and Employee EPF).</span>
                            </div>
                        </td>
                        <td id="opt1_sum_takehome">₹0</td><td id="opt2_sum_takehome">₹0</td><td id="opt3_sum_takehome">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            Annual Income Tax
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Total annual tax payable under the New Tax Regime.</span>
                            </div>
                        </td>
                        <td id="opt1_sum_tax">₹0</td><td id="opt2_sum_tax">₹0</td><td id="opt3_sum_tax">₹0</td>
                    </tr>
                    <tr>
                        <td class="row-header">
                            Annual Wealth & Retirals (Investments)
                            <div class="tooltip">
                                <span class="info-icon">i</span>
                                <span class="tooltiptext">Total retirement wealth built annually (includes Employer and Employee EPF, Employer NPS, and Gratuity provision).</span>
                            </div>
                        </td>
                        <td id="opt1_sum_savings">₹0</td><td id="opt2_sum_savings">₹0</td><td id="opt3_sum_savings">₹0</td>
                    </tr>
                    <tr style="background: rgba(59, 130, 246, 0.1); font-weight: bold;">
                        <td class="row-header">TOTAL EMPLOYER OUTLAY (CTC + Benefits)</td>
                        <td id="opt1_sum_total">₹0</td><td id="opt2_sum_total">₹0</td><td id="opt3_sum_total">₹0</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Compliance Footers -->
        <footer>
            <div class="compliance-card">
                <h4>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#3b82f6;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    New Wage Code Compliance
                </h4>
                <p>Formulated at exactly <strong>50% of CTC for Basic Salary</strong>. This satisfies statutory definitions of "wages" which mandate that allowances and other components must not exceed 50% of the total compensation structure.</p>
            </div>
            <div class="compliance-card">
                <h4>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#10b981;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Section 80CCD(2) Tax Rules
                </h4>
                <p>Under the New Tax Regime, employer's contribution to National Pension System (NPS) is deductible up to <strong>14% of Basic Salary</strong>. Option 3 utilizes this rule to convert high-tax special allowances into tax-exempt retirement capital.</p>
            </div>
            <div class="compliance-card">
                <h4>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#eab308;"><polygon points="12 2 2 22 22 22"></polygon><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Section 87A Rebate & Marginal Relief
                </h4>
                <p>Income tax is completely zero if net taxable income is <strong>under ₹12 Lakhs</strong>. For income slightly above ₹12 Lakhs, <strong>Marginal Relief</strong> ensures that the tax payable does not exceed the income earned over ₹12 Lakhs.</p>
            </div>
        </footer>
      </div>
    </div>`;

    this._initEventListeners();
    this._updateUIDashboard();
  }

  protected onInit(): Promise<void> {
    return Promise.resolve();
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
