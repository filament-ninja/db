import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { rmSync, mkdirSync } from 'node:fs';
import ralToHex from 'ral-to-hex';

const collections = [
    {
        id: "base-materials"
    },
    {
        id: "filaments",
        simple: true
    },
    {
        id: "vendors"
    }
]

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbBaseDir = path.join(__dirname, 'src');
const outputDir = path.join(__dirname, 'dist');

const materials = []

function hexColorCalc (variant) {
    return variant.color?.hex ?? (variant.color?.ral ? ralToHex(variant.color.ral.replace(/^RAL/, '')) : (variant.color?.hexEstimate ?? null))
}

function expandMaterial (item) {
    for (const variant of item.variants) {
        variant.hexColorCalc = hexColorCalc(variant)
    }
    return item
}

async function loadCollection (c) {
    const collectionDir = path.join(dbBaseDir, c.id)
    const entries = fs.readdirSync(collectionDir, { withFileTypes: true });

    let items = []
    console.log(`[${c.id}]`)
    // Iterate over each entry
    for (const entry of entries) {
        // Check if it's a directory
        if (entry.isDirectory()) {
            const id = entry.name; // The directory name is the ID
            const itemDirPath = path.join(collectionDir, id);
            const yamlFilePath = path.join(itemDirPath, 'index.yaml');
    
            if (fs.existsSync(yamlFilePath)) {
                const fileContents = fs.readFileSync(yamlFilePath, 'utf8');
                const parsedData = yaml.load(fileContents);
    
                items.push({ id: id, ...parsedData })
                console.log(`   -> ${id}`);
    
            } else {
                 console.log(` Directory ${id} does not contain index.yaml, skipping.`);
            }
        }
        if (entry.name.match(/.yaml$/)) {
            const id = entry.name.split('.')[0]
            const yamlFilePath = path.join(collectionDir, entry.name);
            const fileContents = fs.readFileSync(yamlFilePath, 'utf8');
            const parsedData = yaml.load(fileContents);
            items.push({ id: id, ...parsedData })
            console.log(`   -> ${id}`);
        }
    }
    if (c.id === 'filaments') {
        const newItems = []
        for (const item of items) {
            materials.push(JSON.parse(JSON.stringify(expandMaterial(item))))
            for (const variant of item.variants) {
                newItems.push({
                    ...variant,
                    sizes: Object.keys(variant.sizes).map(sKey => {
                        const size = variant.sizes[sKey]
                        size.key = sKey
                        const [ diameter, weight, extra ] = size.key.split('/')
                        size.sizeData = {
                            diameter: Number(diameter.match(/([\d\.]+)(mm|)/)[1]),
                            weight: Number(weight.match(/(\d+)(g|)/)[1]),
                            extra
                        }
                        return size
                    }),
                    hexColorCalc: hexColorCalc(variant),
                    name: `${item.name} ${variant.name}`,
                    material: item.material,
                    diameterTolerance: item.diameterTolerance,
                    parentName: item.name,
                    printParams: item.printParams,
                    collection: item.id,
                    vendor: item.vendor,
                })
            }
        }
        items = newItems
    }

    return items
}

const data = {}
for (const c of collections) {
    const res = await loadCollection(c)
    data[c.id] = res
}

data.materials = materials

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'index.json'), JSON.stringify(data, null, 2))