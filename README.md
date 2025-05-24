# Filament Static Database

A static database of 3D printing filaments, their properties, variants, and vendor information. The data is stored in YAML files and compiled into a single JSON file.

## Project Structure

The project is organized as follows:

*   **`src/`**: Contains the raw data for the filament database, organized into subdirectories:
    *   **`base-materials/`**: YAML files defining base filament materials (e.g., PLA, PETG, ABS). Each file describes the material's name, full name, and a brief description.
    *   **`filaments/`**: YAML files detailing specific filament products from various vendors. Each file includes the filament's name, base material, vendor, and a list of variants (e.g., different colors).
    *   **`vendors/`**: YAML files providing information about filament vendors, such as their name, country of origin, and web links.
*   **`schema/`**: This directory is intended for schema definitions for the YAML data files. Currently, the schemas might be implicit or under development.
*   **`utils/`**: Contains utility scripts, including crawlers for automatically gathering filament data from vendor websites.
*   **`dist/`**: This directory is created by the build process and contains the final compiled database (`index.json`).
*   **`index.js`**: The main script responsible for processing the YAML data from `src/` and generating the `dist/index.json` file.
*   **`package.json`**: Defines project metadata, dependencies, and scripts (like `npm run build`).

Data is primarily stored in `.yaml` files, chosen for their human-readable format.

## Data Organization

The data is structured across several types of YAML files:

### Base Materials (`src/base-materials/`)

Each file (e.g., `pla.yaml`) defines a fundamental filament material.

*   `name`: Short name/acronym (e.g., `PLA`).
*   `fullName`: Full chemical name (e.g., `Polylactic Acid`).
*   `description`: Brief overview of the material's properties and common uses.

Example: `src/base-materials/pla.yaml`
```yaml
name: PLA
fullName: Polylactic Acid
description: Ease of use, stiffness, detail. Includes variants like PLA+ (toughness), High-Temp PLA.
```

### Vendors (`src/vendors/`)

Each file (e.g., `bambu-lab.yaml`) provides details about a filament manufacturer or supplier.

*   `name`: Vendor's name (e.g., `Bambu Lab`).
*   `country`: Two-letter country code (e.g., `cn`).
*   `refs`:
    *   `web`: URL to the vendor's main website.

Example: `src/vendors/bambu-lab.yaml`
```yaml
name: Bambu Lab
country: cn
refs:
  web: https://bambulab.com/
```

### Filaments (`src/filaments/`)

Each file (e.g., `bambu-lab-pla-basic.yaml`) describes a specific product line of filament.

*   `name`: Full product name (e.g., `Bambu Lab PLA Basic`).
*   `material`: References a base material ID (e.g., `PLA`, corresponding to `src/base-materials/pla.yaml`).
*   `vendor`: References a vendor ID (e.g., `bambu-lab`, corresponding to `src/vendors/bambu-lab.yaml`).
*   `diameterTolerance` (optional): The tolerance in filament diameter (e.g., `0.02`).
*   `printParams` (optional): Recommended printing parameters, often nested (e.g., `nozzleTemp`, `bedTemp`).
*   `variants`: A list of specific filament variations (usually by color).

### Filament Variants (nested within Filaments)

Each item in the `variants` list represents a purchasable version of the filament.

*   `fid`: A unique Filament ID, automatically generated or assigned.
*   `name`: The specific name of the variant (e.g., `Jade White`).
*   `color` (optional):
    *   `hex`: Hexadecimal color code (e.g., `#FFFFFF`).
    *   `ral`: RAL color code (e.g., `RAL9003`).
    *   `hexEstimate`: If an exact hex is unavailable, an estimated hex code.
*   `images`: A list of URLs for product images.
*   `sizes`: An object where keys define the size and weight (e.g., `1.75mm/1000g`), and values contain:
    *   `link`: URL to purchase this specific size/variant.

Example: Part of `src/filaments/bambu-lab-pla-basic.yaml`
```yaml
name: Bambu Lab PLA Basic
material: PLA
vendor: bambu-lab

variants:
  - fid: iu7ga
    name: Jade White
    color:
      hex: '#FFFFFF'
    images:
      - url: //eu.store.bambulab.com/cdn/shop/files/White.jpg?v=1736242873
    sizes:
      1.75mm/1000g:
        link: >-
          https://eu.store.bambulab.com/en-cz/collections/bambu-lab-3d-printer-filament/products/pla-basic-filament?variant=43992829919451
      1.75mm/1000g/refill:
        link: >-
          https://eu.store.bambulab.com/en-cz/collections/bambu-lab-3d-printer-filament/products/pla-basic-filament?variant=42911327846619
  # ... other variants
```

## Build Process

The project includes a build process managed by `index.js` to consolidate all YAML data into a single JSON file.

1.  **Data Loading**: The script reads data from the `src/` subdirectories:
    *   `base-materials/`
    *   `filaments/`
    *   `vendors/`
2.  **Filament Processing**: Special handling is applied to filament data:
    *   **Color Calculation**: For each filament variant, a `hexColorCalc` property is computed. It attempts to find a HEX color value from `variant.color.hex`, then `variant.color.ral` (converting RAL to HEX), and finally `variant.color.hexEstimate`.
    *   **Variant Expansion**: The script transforms the filament entries. Instead of one entry per filament product, it creates an individual entry for each *variant* (e.g., each color). These expanded variant entries inherit properties from their parent filament and include detailed `sizeData` (parsed diameter and weight) and the `hexColorCalc`.
    *   A separate `materials` list is also created, which appears to be a collection of the filament parent objects after initial processing (like color calculation at the variant level) but before the full variant expansion.
3.  **Output Generation**: All collected and processed data (base materials, vendors, and the expanded filament variants, along with the `materials` list) is compiled into a single JSON object.
4.  **File Writing**: This JSON object is written to `dist/index.json`. The `dist/` directory is cleaned (removed and recreated) on each build.

### Running the Build

To execute the build process, run the following command from the project root:

```bash
npm run build
```

This will:
*   Execute the `node index.js` script.
*   Generate or update the `dist/index.json` file.
*   Print progress messages to the console for each collection being processed.

## Utilities (`utils/`)

The `utils/` directory contains scripts for data management and potentially for aiding in the collection of filament data.

### Crawlers (`utils/crawlers/`)

This subdirectory houses JavaScript files (e.g., `aurapol.js`, `colorfabb.js`). These are likely web crawlers designed to extract filament information automatically from vendor websites. They appear to use libraries such as:

*   `cheerio`: For parsing HTML and XML (similar to jQuery).
*   `node-fetch-cache`: For fetching web content with caching capabilities.

The specifics of each crawler (e.g., which data points it extracts, how up-to-date it is) would need to be examined individually. These scripts are not directly part of the build process but serve as tools for populating or updating the YAML data in the `src/` directory.

## How to Use the Data

The primary output of this project is the `dist/index.json` file, generated by the build process. This JSON file contains a structured representation of all the filament data, including base materials, vendors, and a comprehensive list of individual filament variants with their details.

### Potential Uses

*   **Powering Applications**: The `index.json` can be used as a data source for websites, mobile apps, or other tools that provide information about 3D printing filaments (e.g., a filament browser, a price comparison tool).
*   **Data Analysis**: Researchers or enthusiasts can use the dataset for analyzing trends in filament properties, availability, or pricing.
*   **Local Database**: Developers can integrate this data into local applications that require a catalog of filaments.

The structure of the JSON directly mirrors the processed data described in the "Build Process" section, with top-level keys for `base-materials`, `filaments` (containing the expanded variants), `vendors`, and `materials`.

## Contributing

Contributions to this filament database are welcome! Here are some ways you can help:

*   **Adding New Filaments**:
    1.  Check if the vendor exists in `src/vendors/`. If not, add a new YAML file for the vendor (e.g., `new-vendor.yaml`).
    2.  Check if the base material exists in `src/base-materials/`. If not, add a new YAML file for it (e.g., `new-material.yaml`).
    3.  Create a new YAML file in `src/filaments/` for the new filament product line (e.g., `new-vendor-new-filament.yaml`).
    4.  Fill in the details, including `name`, `material` (linking to the base material ID), `vendor` (linking to the vendor ID), and `variants`.
    5.  For each variant, provide its `name`, `color` information (preferably `hex`), `images`, and `sizes` with direct purchase links. Try to find or generate a unique `fid` if possible, otherwise the build process might assign one.
*   **Updating Existing Data**:
    *   Correct inaccuracies in filament properties, vendor details, or links.
    *   Add new variants (colors, sizes) to existing filaments.
    *   Update purchase links if they are broken or outdated.
*   **Improving Crawlers**:
    *   Enhance existing crawlers in `utils/crawlers/` to be more robust or to extract more data.
    *   Add new crawlers for vendors not yet covered.
*   **Schema Definition**:
    *   If you have expertise in YAML schemas, you could help define or improve the schemas in the `schema/` directory to ensure data consistency.

### General Guidelines

*   Maintain the existing YAML structure.
*   Ensure information is accurate and up-to-date to the best of your ability.
*   For new filament variants, try to provide direct links to the product page where the specific variant can be purchased.
*   Run `npm run build` after making changes to ensure your additions are processed correctly and to update `dist/index.json` (though you typically wouldn't commit `dist/index.json` itself in a PR).

If you're unsure about anything, feel free to open an issue to discuss your proposed changes.

## License

This project is licensed under the ISC License. See the `LICENSE` file for more details (if one exists), or refer to the [ISC License definition](https://opensource.org/licenses/ISC).
