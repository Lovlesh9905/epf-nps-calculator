import { payrollEngine, PayrollResult, DeductionsInput } from './taxEngine';

// Formatting currency in Indian style (INR)
export function formatINR(amount: number): string {
    return "₹" + Math.round(amount).toLocaleString('en-IN');
}

// Toggle Accordion Panel
export function toggleAccordion(): void {
    const panel = document.getElementById('slabAccordion');
    if (panel) {
        panel.classList.toggle('open');
    }
}

// Render dynamic tax slab breakdown
export function renderTaxBreakdown(optionResult: PayrollResult): void {
    const tbody = document.getElementById('slabBreakdownBody');
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
        taxableTd.innerText = formatINR(slab.taxableInSlab);

        const taxTd = document.createElement('td');
        taxTd.innerText = formatINR(slab.taxInSlab);

        tr.appendChild(rangeTd);
        tr.appendChild(rateTd);
        tr.appendChild(taxableTd);
        tr.appendChild(taxTd);
        tbody.appendChild(tr);
    });

    // Update Summary labels
    const lblGross = document.getElementById('lbl_gross');
    if (lblGross) {
        const stdDed = optionResult.taxRegime === "old" ? 50000 : 75000;
        lblGross.innerText = formatINR(optionResult.taxableBase + stdDed + optionResult.deductionsTotal);
    }

    const lblSlabTax = document.getElementById('lbl_slab_tax');
    if (lblSlabTax) lblSlabTax.innerText = formatINR(taxRes.originalSlabTax);
    
    const lblRelief = document.getElementById('lbl_relief');
    if (lblRelief) {
        let reliefText = "₹0";
        if (taxRes.rebate > 0) {
            reliefText = "-" + formatINR(taxRes.rebate) + " (Sec 87A Rebate)";
        } else if (taxRes.marginalRelief > 0) {
            reliefText = "-" + formatINR(taxRes.marginalRelief) + " (Marginal Relief)";
        }
        lblRelief.innerText = reliefText;
    }

    const lblCess = document.getElementById('lbl_cess');
    if (lblCess) lblCess.innerText = formatINR(taxRes.cess);

    const lblNetTax = document.getElementById('lbl_net_tax');
    if (lblNetTax) lblNetTax.innerText = formatINR(optionResult.annualTax);
}

// Update the full UI dashboard
export function updateUIDashboard(
    ctc: number, 
    currentSelectedOption: number, 
    gratuityInCTC: boolean,
    taxRegime: "new" | "old" = "new",
    deductions?: DeductionsInput
): void {
    const results: { [key: number]: PayrollResult } = {};

    // 0. Update Table Header for Gratuity and Tax Regime dynamically
    const lblGratuityHeader = document.getElementById('lbl_gratuity_header');
    if (lblGratuityHeader) {
        lblGratuityHeader.innerText = gratuityInCTC ? "Gratuity Provision (4.81%)" : "Gratuity Provision (Outside CTC)";
    }
    const lblTaxPipelineHeader = document.getElementById('lbl_tax_pipeline_header');
    if (lblTaxPipelineHeader) {
        lblTaxPipelineHeader.innerText = taxRegime === "old" ? "D. Taxation Pipeline (Old Tax Regime Slabs)" : "D. Taxation Pipeline (New Tax Regime Slabs)";
    }
    const badgeRegime = document.querySelector('.badge-regime') as HTMLElement | null;
    if (badgeRegime) {
        badgeRegime.innerText = taxRegime === "old" ? "Old Tax Regime" : "FY 2026-27 | New Tax Regime";
    }
    const cardOpt3Title = document.getElementById('card_opt3_title');
    if (cardOpt3Title) {
        cardOpt3Title.innerText = taxRegime === "old" ? "Optimised (Full EPF + 10% NPS)" : "Optimised (Full EPF + 14% NPS)";
    }
    const lblNpsHeader = document.getElementById('lbl_nps_header');
    if (lblNpsHeader) {
        lblNpsHeader.innerText = taxRegime === "old" ? "Employer NPS Contribution (10%)" : "Employer NPS Contribution (14%)";
    }

    // Calculate for all three options
    for (let opt = 1; opt <= 3; opt++) {
        const res = payrollEngine(ctc, opt, gratuityInCTC, taxRegime, deductions);
        results[opt] = res;

        // 1. Update Detailed Table Cell elements
        const elementsToUpdate = {
            basic: document.getElementById(`opt${opt}_basic`),
            hra: document.getElementById(`opt${opt}_hra`),
            bonus: document.getElementById(`opt${opt}_bonus`),
            conveyance: document.getElementById(`opt${opt}_conveyance`),
            er_pf: document.getElementById(`opt${opt}_er_pf`),
            pf_admin: document.getElementById(`opt${opt}_pf_admin`),
            edli: document.getElementById(`opt${opt}_edli`),
            er_nps: document.getElementById(`opt${opt}_er_nps`),
            gratuity: document.getElementById(`opt${opt}_gratuity`),
            special: document.getElementById(`opt${opt}_special`),
            ctc: document.getElementById(`opt${opt}_ctc`),
            gross: document.getElementById(`opt${opt}_gross`),
            applied_regime: document.getElementById(`opt${opt}_applied_regime`),
            std_ded: document.getElementById(`opt${opt}_std_ded`),
            deductions: document.getElementById(`opt${opt}_deductions`),
            taxable_base: document.getElementById(`opt${opt}_taxable_base`),
            tax_table: document.getElementById(`opt${opt}_tax_table`),
            ee_pf: document.getElementById(`opt${opt}_ee_pf`),
            takehome: document.getElementById(`opt${opt}_takehome`),
            sum_takehome: document.getElementById(`opt${opt}_sum_takehome`),
            sum_tax: document.getElementById(`opt${opt}_sum_tax`),
            sum_savings: document.getElementById(`opt${opt}_sum_savings`),
            sum_total: document.getElementById(`opt${opt}_sum_total`)
        };

        if (elementsToUpdate.basic) elementsToUpdate.basic.innerText = formatINR(res.basic);
        if (elementsToUpdate.hra) elementsToUpdate.hra.innerText = formatINR(res.hra);
        if (elementsToUpdate.bonus) elementsToUpdate.bonus.innerText = formatINR(res.bonus);
        if (elementsToUpdate.conveyance) elementsToUpdate.conveyance.innerText = formatINR(res.conveyance);
        if (elementsToUpdate.er_pf) elementsToUpdate.er_pf.innerText = formatINR(res.er_pf);
        if (elementsToUpdate.pf_admin) elementsToUpdate.pf_admin.innerText = formatINR(res.pfAdmin);
        if (elementsToUpdate.edli) elementsToUpdate.edli.innerText = formatINR(res.edli);
        if (elementsToUpdate.er_nps) elementsToUpdate.er_nps.innerText = formatINR(res.er_nps);
        if (elementsToUpdate.gratuity) elementsToUpdate.gratuity.innerText = gratuityInCTC ? formatINR(res.gratuity) : "₹0";
        if (elementsToUpdate.special) elementsToUpdate.special.innerText = formatINR(res.allowance);
        if (elementsToUpdate.ctc) elementsToUpdate.ctc.innerText = formatINR(ctc);
        if (elementsToUpdate.gross) elementsToUpdate.gross.innerText = formatINR(res.grossSalary);
        
        if (elementsToUpdate.applied_regime) {
            elementsToUpdate.applied_regime.innerText = res.taxRegime === "old" ? "Old Regime" : "New Regime";
        }
        if (elementsToUpdate.std_ded) {
            elementsToUpdate.std_ded.innerText = res.taxRegime === "old" ? "-₹50,000" : "-₹75,000";
        }
        if (elementsToUpdate.deductions) {
            elementsToUpdate.deductions.innerText = res.taxRegime === "old" ? "-" + formatINR(res.deductionsTotal) : "₹0";
        }

        if (elementsToUpdate.taxable_base) elementsToUpdate.taxable_base.innerText = formatINR(res.taxableBase);
        if (elementsToUpdate.tax_table) elementsToUpdate.tax_table.innerText = formatINR(res.annualTax);
        if (elementsToUpdate.ee_pf) elementsToUpdate.ee_pf.innerText = formatINR(res.monthlyEePf) + " / mo";
        if (elementsToUpdate.takehome) elementsToUpdate.takehome.innerText = formatINR(res.monthlyTakehome) + " / mo";

        // 2. Update Dashboard Card Values
        const cardTakehome = document.getElementById(`card_opt${opt}_takehome`);
        if (cardTakehome) cardTakehome.innerText = formatINR(res.monthlyTakehome);

        const cardTax = document.getElementById(`card_opt${opt}_tax`);
        if (cardTax) cardTax.innerText = formatINR(res.annualTax);

        const cardSavings = document.getElementById(`card_opt${opt}_savings`);
        if (cardSavings) cardSavings.innerText = formatINR(res.totalSavings);

        // 3. Update Graphic Progress Bars
        const annualTakehomeTotal = res.monthlyTakehome * 12;
        const sumComponents = annualTakehomeTotal + res.annualTax + res.totalSavings;
        
        const takehomePct = sumComponents > 0 ? Math.round((annualTakehomeTotal / sumComponents) * 100) : 0;
        const taxPct = sumComponents > 0 ? Math.round((res.annualTax / sumComponents) * 100) : 0;
        const savingsPct = 100 - takehomePct - taxPct; // Ensure it adds up to exactly 100%

        const barTakehome = document.getElementById(`bar_opt${opt}_takehome`);
        if (barTakehome) barTakehome.style.width = takehomePct + "%";

        const barTax = document.getElementById(`bar_opt${opt}_tax`);
        if (barTax) barTax.style.width = taxPct + "%";

        const barSavings = document.getElementById(`bar_opt${opt}_savings`);
        if (barSavings) barSavings.style.width = savingsPct + "%";

        const pctTakehome = document.getElementById(`pct_opt${opt}_takehome`);
        if (pctTakehome) pctTakehome.innerText = takehomePct + "%";

        const pctTax = document.getElementById(`pct_opt${opt}_tax`);
        if (pctTax) pctTax.innerText = taxPct + "%";

        const pctSavings = document.getElementById(`pct_opt${opt}_savings`);
        if (pctSavings) pctSavings.innerText = savingsPct + "%";

        const annualTakehome = res.monthlyTakehome * 12;
        const totalOutlay = annualTakehome + res.annualTax + res.totalSavings + res.pfAdmin;

        if (elementsToUpdate.sum_takehome) elementsToUpdate.sum_takehome.innerText = formatINR(annualTakehome);
        if (elementsToUpdate.sum_tax) elementsToUpdate.sum_tax.innerText = formatINR(res.annualTax);
        if (elementsToUpdate.sum_savings) elementsToUpdate.sum_savings.innerText = formatINR(res.totalSavings);
        if (elementsToUpdate.sum_total) elementsToUpdate.sum_total.innerText = formatINR(totalOutlay);
    }

    // 4. Render Selected Detailed Tax Slab Breakdown
    renderTaxBreakdown(results[currentSelectedOption]);
}
