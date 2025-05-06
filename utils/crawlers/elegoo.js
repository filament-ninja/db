import fs from 'node:fs'
import yaml from 'js-yaml'
import { xfid } from '../xfid.js'

const bundle = JSON.parse(fs.readFileSync('./dist/index.json'))

async function crawlProduct (product) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.web)
    const html = await pg.text()
    const match = html.match(/"productVariants":(\[[^\]]+\])/m)
    if (!match) {
        console.error(`No match! ${product.id}, ${product.refs.web}`)
        return
    }
    const variants = JSON.parse(match[1])
    const newItems = []
    for (const v of variants) {
        const name = v.title.replace(/^Silk /, '')
        if (Object.values(dbItem.variants).find(ov => Object.values(ov.sizes).find(os => os.sku === v.sku))) {
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
                    link: `https://eu.elegoo.com${v.product.url}?variant=${v.id}`,
                }
            }
        })
    }
    if (newItems.length > 0) {
        console.log(`----->>> [${product.id}] new items:`)
        console.log(yaml.dump({ variants: newItems }))
    }
}

for (const p of bundle.materials.filter(m => m.vendor === 'elegoo')) {
    if (!p.refs?.web) {
        console.error(`no web: ${p.id}`)
        continue
    }
    await crawlProduct(p)
}