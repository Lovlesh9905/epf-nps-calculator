# SPFx Web Part Deployment Guide

This folder contains the SharePoint Framework (SPFx) client-side web part implementation of the **EPF and NPS Restructuring Calculator**.

---

## 🛠️ Prerequisites
Before building and packaging the web part, make sure your machine has:
1. **Node.js**: Recommended version is **Node.js LTS v18** or **v16** (SPFx has specific Node version compatibility depending on SharePoint version).
2. **Gulp CLI**:
   ```bash
   npm install --global gulp-cli
   ```

---

## 💻 Local Testing in SharePoint Workbench
To run and test the web part locally:
1. Navigate into the SPFx project directory:
   ```bash
   cd epf-nps-calculator-spfx
   ```
2. Install all development dependencies:
   ```bash
   npm install
   ```
3. Run the local serve gulp task:
   ```bash
   gulp serve
   ```
4. Open the hosted SharePoint Workbench page:
   `https://<your-tenant>.sharepoint.com/_layouts/15/workbench.aspx`
5. Click the **`+`** icon to add the **EpfNpsCalculator** web part to the canvas!

---

## 📦 Production Packaging and Deployment
To compile, package, and upload the web part to your organization's SharePoint intranet catalog:

1. **Clean & Build**:
   ```bash
   gulp clean
   gulp build
   ```
2. **Bundle & Package**:
   ```bash
   gulp bundle --ship
   gulp package-solution --ship
   ```
3. **Locate Package**:
   The generated SharePoint installer package will be located at:
   `epf-nps-calculator-spfx/sharepoint/solution/epf-nps-calculator-spfx.sppkg`
4. **Deploy**:
   * Open your SharePoint admin **App Catalog** (e.g. `https://<tenant>-admin.sharepoint.com/_layouts/15/tenantAppCatalog.aspx`).
   * Drag and drop the `epf-nps-calculator-spfx.sppkg` file into the catalog list.
   * Check **"Enable this app and add it to all sites"** and click **Enable App**.
5. **Add to Modern Page**:
   Go to any modern SharePoint page, click **Edit**, add the **EpfNpsCalculator** web part, and publish!
