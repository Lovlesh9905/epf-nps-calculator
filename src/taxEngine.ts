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

// Payroll Calculator Engine
export function payrollEngine(ctc: number, optionType: number, gratuityInCTC: boolean): PayrollResult {
    const basic = ctc * 0.50; // New Wage Code standard 50%
    const hra = basic * 0.40;
    const gratuity = basic * 0.0481;
    
    let er_pf = 0;
    let er_nps = 0;
    let ee_pf = 0;

    if (optionType === 1) {
        // Minimalist: Capped EPF basic of ₹15,000 monthly (₹1,80,000 annualized)
        const epf_basis = Math.min(basic, 15000 * 12);
        er_pf = epf_basis * 0.12; 
        er_nps = 0;
        ee_pf = epf_basis * 0.12;
    } else if (optionType === 2) {
        // Traditional: Full EPF
        er_pf = basic * 0.12;
        er_nps = 0;
        ee_pf = basic * 0.12;
    } else if (optionType === 3) {
        // Optimised: Full EPF + 14% NPS
        er_pf = basic * 0.12;
        er_nps = basic * 0.14;
        ee_pf = basic * 0.12;
    }

    // Balancing Special Allowance: Gratuity deduction depends on gratuityInCTC flag
    const deductionBase = basic + hra + er_pf + er_nps + (gratuityInCTC ? gratuity : 0);
    let specialAllowance = ctc - deductionBase;
    if (specialAllowance < 0) {
        specialAllowance = 0; // Avoid negative bounds for low CTC
    }

    const grossSalary = basic + hra + specialAllowance; 
    let taxableBase = grossSalary - 75000; // Deduct Standard Deduction
    if (taxableBase < 0) taxableBase = 0;

    const taxResult = calculateNewRegimeTax(taxableBase);
    
    const monthlyGross = grossSalary / 12;
    const monthlyTax = taxResult.totalTax / 12;
    const monthlyEePf = ee_pf / 12;
    
    // Takehome: gross - tax - employee contribution
    const monthlyTakehome = monthlyGross - monthlyTax - monthlyEePf;
    
    // Savings = Employer EPF + Employer NPS + Employee EPF + Gratuity
    const totalSavings = er_pf + er_nps + ee_pf + gratuity;

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
        gratuityInCTC
    };
}
