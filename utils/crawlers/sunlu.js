import fs from 'node:fs'
import yaml from 'js-yaml'
import { xfid } from '../xfid.js'

const bundle = JSON.parse(fs.readFileSync('./dist/index.json'))

async function crawlProduct (product) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.web)
    const html = await pg.text()
    const match = html.match(/"productVariants":(\[.+\]),"purchasingCompany":null}/m)
    if (!match) {
        console.error(`No match! ${product.id}, ${product.refs.web}`)
        return
    }
    const variants = JSON.parse(match[1])
    const newItems = []

    for (const v of variants) {
        if (!v.title.match(/^(Ship to Europe|Europe)/)) {
            continue
        }

        if (product.id === 'sunlu-petg' && v.title.match(/High Speed/)) {
            continue
        }
        if (product.id === 'sunlu-petg-hs' && !v.title.match(/High Speed/)) {
            continue
        }
        //console.log(v)

        let name = v.title.replace(/^(Ship to Europe|Europe) \/ (PLA |PLA\+ |PETG |1KG ABS \| |)/, '').replace('(', ' (').replace('SILK', 'Silk')
        if (product.id === 'sunlu-matte-pla') {
            if (name.match(/Rainbow/)) {
                continue
            }
            name = name.replace(/^Matte /, '')
        }

        if (Object.values(dbItem.variants || []).find(ov => Object.values(ov.sizes).find(os => os.sku === v.sku))) {
            continue
        }
        //console.log({ color: v.title, price: v.price.amount, currency: v.price.currencyCode, img: v.image.src, sku: v.sku, url:  })
        newItems.push({
            fid: await xfid(),
            name: name,
            images: [
                { url: v.image.src }
            ],
            sizes: {
                '1.75mm/1000g': {
                    sku: v.sku,
                    link: `https://www.sunlu.com${v.product.url}?variant=${v.id}`,
                }
            }
        })
    }
    if (newItems.length > 0) {
        console.log(`----->>> [${product.id}] new items:`)
        console.log(yaml.dump({ variants: newItems }))
    }
}

for (const p of bundle.materials.filter(m => m.vendor === 'sunlu')) {
    if (!p.refs?.web) {
        console.error(`no web: ${p.id}`)
        continue
    }
    await crawlProduct(p)
}