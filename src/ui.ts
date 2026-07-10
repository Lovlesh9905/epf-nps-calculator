import { payrollEngine, PayrollResult } from './taxEngine';

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
    if (lblGross) lblGross.innerText = formatINR(optionResult.taxableBase + 75000);

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
export function updateUIDashboard(ctc: number, currentSelectedOption: number, gratuityInCTC: boolean): void {
    const results: { [key: number]: PayrollResult } = {};

    // 0. Update Table Header for Gratuity dynamically
    const lblGratuityHeader = document.getElementById('lbl_gratuity_header');
    if (lblGratuityHeader) {
        lblGratuityHeader.innerText = gratuityInCTC ? "Gratuity Provision" : "Gratuity Provision (Outside CTC)";
    }

    // Calculate for all three options
    for (let opt = 1; opt <= 3; opt++) {
        const res = payrollEngine(ctc, opt, gratuityInCTC);
        results[opt] = res;

        // 1. Update Detailed Table Cell elements
        const elementsToUpdate = {
            basic: document.getElementById(`opt${opt}_basic`),
            hra: document.getElementById(`opt${opt}_hra`),
            er_pf: document.getElementById(`opt${opt}_er_pf`),
            er_nps: document.getElementById(`opt${opt}_er_nps`),
            gratuity: document.getElementById(`opt${opt}_gratuity`),
            special: document.getElementById(`opt${opt}_special`),
            ctc: document.getElementById(`opt${opt}_ctc`),
            gross: document.getElementById(`opt${opt}_gross`),
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
        if (elementsToUpdate.er_pf) elementsToUpdate.er_pf.innerText = formatINR(res.er_pf);
        if (elementsToUpdate.er_nps) elementsToUpdate.er_nps.innerText = formatINR(res.er_nps);
        if (elementsToUpdate.gratuity) elementsToUpdate.gratuity.innerText = gratuityInCTC ? formatINR(res.gratuity) : "₹0";
        if (elementsToUpdate.special) elementsToUpdate.special.innerText = formatINR(res.allowance);
        if (elementsToUpdate.ctc) elementsToUpdate.ctc.innerText = formatINR(ctc);
        if (elementsToUpdate.gross) elementsToUpdate.gross.innerText = formatINR(res.grossSalary);
        if (elementsToUpdate.taxable_base) elementsToUpdate.taxable_base.innerText = formatINR(res.taxableBase);
        if (elementsToUpdate.tax_table) elementsToUpdate.tax_table.innerText = formatINR(res.annualTax);
        if (elementsToUpdate.ee_pf) elementsToUpdate.ee_pf.innerText = formatINR(res.monthlyEePf) + " / mo";
        if (elementsToUpdate.takehome) elementsToUpdate.takehome.innerText = formatINR(res.monthlyTakehome) + " / mo";

        const annualTakehome = res.monthlyTakehome * 12;
        const totalOutlay = annualTakehome + res.annualTax + res.totalSavings;

        if (elementsToUpdate.sum_takehome) elementsToUpdate.sum_takehome.innerText = formatINR(annualTakehome);
        if (elementsToUpdate.sum_tax) elementsToUpdate.sum_tax.innerText = formatINR(res.annualTax);
        if (elementsToUpdate.sum_savings) elementsToUpdate.sum_savings.innerText = formatINR(res.totalSavings);
        if (elementsToUpdate.sum_total) elementsToUpdate.sum_total.innerText = formatINR(totalOutlay);

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
    }

    // 4. Render Selected Detailed Tax Slab Breakdown
    renderTaxBreakdown(results[currentSelectedOption]);
}
