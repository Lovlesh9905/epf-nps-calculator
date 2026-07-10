# Dynamic CTC Restructuring Dashboard (FY 2026-27)

A sleek, premium, and interactive web application designed to help employees optimize their salary structure, minimize income tax, and maximize retirement savings (EPF & NPS) under the **New Wage Code** and the **New Tax Regime**.

Designed to run locally or host on a corporate intranet (LAN).

---

## 🚀 Key Features

* **New Wage Code Compliance**: Automatically structures **Basic Salary at exactly 50% of CTC** (mandating allowances do not exceed 50% of the total compensation structure).
* **FY 2026-27 Tax Engine**: Fully implements the latest New Tax Regime rules:
  * **Section 87A Rebate**: Tax is completely zero if net taxable income is **under ₹12 Lakhs**.
  * **Section 87A Marginal Relief**: Prevents a tax cliff for incomes slightly above ₹12 Lakhs (capping tax before cess at the excess income earned over ₹12 Lakhs).
  * **Standard Deduction**: Accounts for the ₹75,000 standard deduction.
* **Flexible Gratuity Option**: Includes a dynamic toggle switch to specify whether the 4.81% Gratuity provision is deducted from the CTC basket or paid separately on top of it.
* **Comparative Dashboard**:
  * Side-by-side card layouts for **Minimalist (15K EPF Cap)**, **Traditional (12% Full EPF)**, and **Optimised (Full EPF + 14% NPS)** options.
  * Segmented bar charts illustrating the visual percentage split of CTC between In-Hand cash, Taxes, and Retiral investments.
  * Tabbed slab-by-slab tax breakdown panel.
  * Annualized CTC allocation summary showing total employer outlay.

---

## 📂 Project Structure

```
├── index.html                  # Core HTML markup and layout
├── package.json                # npm script definitions and dependencies (Vite & TypeScript)
├── tsconfig.json              # TypeScript compiler configuration
├── vite.config.ts             # Vite bundler config (port 3000, host: true for intranet sharing)
└── src/
    ├── style.css               # CSS styling (dark slate glassmorphism theme and custom switches)
    ├── taxEngine.ts            # Mathematical engines (payroll algorithms & tax calculators)
    ├── ui.ts                   # DOM element updates and layout progress bar charts
    └── main.ts                 # App entry point, event listeners, and input sync controls
```

---

## 🛠️ Installation & Setup

1. **Install Dependencies**:
   Open a terminal in this folder and run:
   ```bash
   npm install
   ```
2. **Start the Local Server**:
   ```bash
   npm run dev
   ```
   *Vite will start the server on port `3000` and automatically open the dashboard in your default browser.*
3. **Compile & Build for Production**:
   ```bash
   npm run build
   ```
   *Compiles TypeScript and generates optimized static assets inside the `dist/` directory, suitable for production web server hosting.*

---

## 🌐 Sharing on the Intranet (LAN)

The tool is pre-configured to be accessible to other devices on your local network (intranet). When you start `npm run dev`, share the **Network URL** listed in the terminal (e.g., `http://192.168.x.x:3000/`).

### Windows Firewall Configuration
If colleagues cannot connect to your local dev port, run this command in **PowerShell (as Administrator)** to open port 3000:
```powershell
New-NetFirewallRule -DisplayName "Allow Vite Port 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
```

### Run Permanently in the Background
To keep the server hosting in the background even after closing your terminal window, use a manager like **PM2**:
1. Install globally: `npm install -g pm2`
2. Launch process: `pm2 start "npm run dev" --name "ctc-calculator"`
3. Terminate process: `pm2 delete ctc-calculator`
