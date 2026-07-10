export interface TaxSlabDetail {
    range: string;
    rate: string;
    taxableInSlab: number;
    taxInSlab: number;
}

export interface TaxResult {
    totalTax: number;
    originalSlabTax: number;
    rebate: number;
    marginalRelief: number;
    cess: number;
    slabDetails: TaxSlabDetail[];
}

export interface DeductionsInput {
    voluntary80c: number;
    voluntaryNps: number;
    healthInsurance: number;
    homeLoanInterest: number;
    monthlyRent: number;
    otherExemptions: number;
}

export interface PayrollResult {
    basic: number;
    hra: number;
    er_pf: number;
    er_nps: number;
    gratuity: number;
    allowance: number;
    grossSalary: number;
    taxableBase: number;
    annualTax: number;
    monthlyEePf: number;
    monthlyTakehome: number;
    totalSavings: number;
    taxResult: TaxResult;
    gratuityInCTC: boolean;
    pfAdmin: number;
    edli: number;
    bonus: number;
    taxRegime: "new" | "old";
    hraExemption: number;
    deductionsTotal: number;
    conveyance: number;
}

// Tax Engine: FY 2026-27 (New Tax Regime) Slabs, Rebates, & Marginal Relief
export function calculateNewRegimeTax(taxableIncome: number): TaxResult {
    const slabs = [
        { limit: 400000, rate: 0.00 },
        { limit: 800000, rate: 0.05 },
        { limit: 1200000, rate: 0.10 },
        { limit: 1600000, rate: 0.15 },
        { limit: 2000000, rate: 0.20 },
        { limit: 2400000, rate: 0.25 },
        { limit: Infinity, rate: 0.30 }
    ];

    let tax = 0;
    let previousLimit = 0;
    const slabDetails: TaxSlabDetail[] = [];

    // Slab tax calculation
    for (let i = 0; i < slabs.length; i++) {
        if (taxableIncome > previousLimit) {
            const taxableInSlab = Math.min(taxableIncome - previousLimit, slabs[i].limit - previousLimit);
            const taxInSlab = taxableInSlab * slabs[i].rate;
            tax += taxInSlab;
            
            let rangeText = "";
            if (previousLimit === 0) {
                rangeText = "0 to ₹4 Lakhs";
            } else if (slabs[i].limit === Infinity) {
                rangeText = `Above ₹${(previousLimit / 100000).toFixed(1)} Lakhs`;
            } else {
                rangeText = `₹${(previousLimit / 100000).toFixed(1)} to ₹${(slabs[i].limit / 100000).toFixed(1)} Lakhs`;
            }

            slabDetails.push({
                range: rangeText,
                rate: `${slabs[i].rate * 100}%`,
                taxableInSlab,
                taxInSlab
            });

            previousLimit = slabs[i].limit;
        } else {
            // Renders remaining empty slabs for layout completeness
            let rangeText = "";
            if (slabs[i].limit === Infinity) {
                rangeText = `Above ₹${(previousLimit / 100000).toFixed(1)} Lakhs`;
            } else {
                rangeText = `₹${(previousLimit / 100000).toFixed(1)} to ₹${(slabs[i].limit / 100000).toFixed(1)} Lakhs`;
            }
            
            slabDetails.push({
                range: rangeText,
                rate: `${slabs[i].rate * 100}%`,
                taxableInSlab: 0,
                taxInSlab: 0
            });
            
            previousLimit = slabs[i].limit;
        }
    }

    const originalSlabTax = tax;
    let rebate = 0;
    let marginalRelief = 0;

    // Apply Section 87A rebate & marginal relief
    if (taxableIncome <= 1200000) {
        rebate = originalSlabTax; // Full tax rebate up to ₹12L
        tax = 0;
    } else {
        // Marginal Relief: The tax payable (before Cess) cannot exceed the income exceeding ₹12 Lakhs
        const excessIncome = taxableIncome - 1200000;
        if (originalSlabTax > excessIncome) {
            marginalRelief = originalSlabTax - excessIncome;
            tax = excessIncome;
        }
    }

    const cess = tax * 0.04;
    const totalTax = tax + cess;

    return {
        totalTax,
        originalSlabTax,
        rebate,
        marginalRelief,
        cess,
        slabDetails
    };
}

// Tax Engine: Old Tax Regime Slabs & 87A Rebate Rules
export function calculateOldRegimeTax(taxableIncome: number): TaxResult {
    const slabs = [
        { limit: 250000, rate: 0.00 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 }
    ];

    let tax = 0;
    let previousLimit = 0;
    const slabDetails: TaxSlabDetail[] = [];

    for (let i = 0; i < slabs.length; i++) {
        if (taxableIncome > previousLimit) {
            const taxableInSlab = Math.min(taxableIncome - previousLimit, slabs[i].limit - previousLimit);
            const taxInSlab = taxableInSlab * slabs[i].rate;
            tax += taxInSlab;
            
            let rangeText = "";
            if (previousLimit === 0) {
                rangeText = "0 to ₹2.5 Lakhs";
            } else if (slabs[i].limit === Infinity) {
                rangeText = `Above ₹${(previousLimit / 100000).toFixed(1)} Lakhs`;
            } else {
                rangeText = `₹${(previousLimit / 100000).toFixed(1)} to ₹${(slabs[i].limit / 100000).toFixed(1)} Lakhs`;
            }

            slabDetails.push({
                range: rangeText,
                rate: `${slabs[i].rate * 100}%`,
                taxableInSlab,
                taxInSlab
            });

            previousLimit = slabs[i].limit;
        } else {
            let rangeText = "";
            if (slabs[i].limit === Infinity) {
                rangeText = `Above ₹${(previousLimit / 100000).toFixed(1)} Lakhs`;
            } else {
                rangeText = `₹${(previousLimit / 100000).toFixed(1)} to ₹${(slabs[i].limit / 100000).toFixed(1)} Lakhs`;
            }

            slabDetails.push({
                range: rangeText,
                rate: `${slabs[i].rate * 100}%`,
                taxableInSlab: 0,
                taxInSlab: 0
            });
            
            previousLimit = slabs[i].limit;
        }
    }

    const originalSlabTax = tax;
    let rebate = 0;
    let marginalRelief = 0;

    // Apply Section 87A rebate for Old Regime: Up to ₹12,500 if total taxable income <= ₹5 Lakhs
    if (taxableIncome <= 500000) {
        rebate = originalSlabTax;
        tax = 0;
    }

    const cess = tax * 0.04;
    const totalTax = tax + cess;

    return {
        totalTax,
        originalSlabTax,
        rebate,
        marginalRelief,
        cess,
        slabDetails
    };
}

// Payroll Calculator Engine
export function payrollEngine(
    ctc: number, 
    optionType: number, 
    gratuityInCTC: boolean,
    taxRegime: "new" | "old" = "new",
    deductions: DeductionsInput = {
        voluntary80c: 100000,
        voluntaryNps: 0,
        healthInsurance: 25000,
        homeLoanInterest: 0,
        monthlyRent: 0,
        otherExemptions: 0
    }
): PayrollResult {
    const basic = ctc * 0.50; // New Wage Code standard 50%
    const hra = basic * 0.40;
    const gratuity = gratuityInCTC ? (basic * 0.0481) : 0;
    const bonus = basic * 0.08333; // 8.333% of Basic
    const conveyance = 19200; // Conveyance Allowance
    
    let er_pf = 0;
    let er_nps = 0;
    let ee_pf = 0;
    let pf_basis = 0;

    if (optionType === 1) {
        // Minimalist: Capped EPF basic of ₹15,000 monthly (₹1,80,000 annualized)
        pf_basis = Math.min(basic, 15000 * 12);
        er_pf = pf_basis * 0.12; 
        er_nps = 0;
        ee_pf = pf_basis * 0.12;
    } else if (optionType === 2) {
        // Traditional: Full EPF
        pf_basis = basic;
        er_pf = pf_basis * 0.12;
        er_nps = 0;
        ee_pf = pf_basis * 0.12;
    } else if (optionType === 3) {
        // Optimised: Full EPF + 14% NPS (in New Regime, 14% is exempt; in Old Regime, 10% is exempt, 4% is taxable)
        pf_basis = basic;
        er_pf = pf_basis * 0.12;
        er_nps = basic * 0.14;
        ee_pf = pf_basis * 0.12;
    }

    const pfAdmin = pf_basis * 0.005; // 0.5% PF Admin Charges
    const edli = Math.min(basic, 15000 * 12) * 0.005; // 0.5% EDLI Contribution (capped at 15k monthly basic)

    // Balancing Special Allowance: Deducted from Special Allowance so that total CTC remains neutral
    const deductionBase = basic + hra + er_pf + pfAdmin + edli + er_nps + gratuity + bonus + conveyance;
    let specialAllowance = ctc - deductionBase;
    if (specialAllowance < 0) {
        specialAllowance = 0; // Avoid negative bounds for low CTC
    }

    const grossSalary = basic + hra + specialAllowance + bonus + conveyance; 
    
    // Standard deduction
    const standardDeduction = taxRegime === "old" ? 50000 : 75000;

    // HRA Exemption (only applicable in Old Regime)
    let hraExemption = 0;
    if (taxRegime === "old") {
        const annualRent = deductions.monthlyRent * 12;
        // Exemption is minimum of Rent - 10% of Basic, actual HRA, or 40% non-metro rate
        hraExemption = Math.max(0, Math.min(hra, annualRent - (basic * 0.10)));
    }

    // Section 80C Deduction (Old Regime only, capped at 1.5L, includes employee EPF)
    let deduction80C = 0;
    if (taxRegime === "old") {
        deduction80C = Math.min(150000, deductions.voluntary80c + ee_pf);
    }

    // Other Old Regime Deductions
    const voluntaryNps = taxRegime === "old" ? Math.min(50000, deductions.voluntaryNps) : 0;
    const healthInsurance = taxRegime === "old" ? Math.min(100000, deductions.healthInsurance) : 0;
    const homeLoanInterest = taxRegime === "old" ? Math.min(200000, deductions.homeLoanInterest) : 0;
    const otherExemptions = taxRegime === "old" ? deductions.otherExemptions : 0;

    // Employer NPS Taxable prerequisite: In Old Regime, employer contribution above 10% basic is taxable (Option 3 has 14%)
    let taxableEmployerNps = 0;
    if (taxRegime === "old" && optionType === 3) {
        taxableEmployerNps = basic * 0.04; 
    }

    const deductionsTotal = hraExemption + deduction80C + voluntaryNps + healthInsurance + homeLoanInterest + otherExemptions;

    let taxableBase = grossSalary - standardDeduction - deductionsTotal + taxableEmployerNps;
    if (taxableBase < 0) taxableBase = 0;

    const taxResult = taxRegime === "old" ? calculateOldRegimeTax(taxableBase) : calculateNewRegimeTax(taxableBase);
    
    const monthlyGross = grossSalary / 12;
    const monthlyTax = taxResult.totalTax / 12;
    const monthlyEePf = ee_pf / 12;
    
    // Takehome: gross - tax - employee contribution
    const monthlyTakehome = monthlyGross - monthlyTax - monthlyEePf;
    
    // Savings = Employer EPF + Employer NPS + Employee EPF + Gratuity + EDLI
    const totalSavings = er_pf + er_nps + ee_pf + gratuity + edli;

    return {
        basic,
        hra,
        er_pf,
        er_nps,
        gratuity,
        allowance: specialAllowance,
        grossSalary,
        taxableBase,
        annualTax: taxResult.totalTax,
        monthlyEePf,
        monthlyTakehome,
        totalSavings,
        taxResult,
        gratuityInCTC,
        pfAdmin,
        edli,
        bonus,
        taxRegime,
        hraExemption,
        deductionsTotal,
        conveyance
    };
}
