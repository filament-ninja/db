import fs from 'node:fs'
import yaml from 'js-yaml'
import { xfid } from '../xfid.js'
import * as cheerio from 'cheerio'
import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';

const fetch = NodeFetchCache.create({
  cache: new FileSystemCache(),
});

const bundle = JSON.parse(fs.readFileSync('./dist/index.json'))
let newItems = []

async function crawlDetail (product, item) {
    const res = await fetch(item.url)
    const $ = cheerio.load(await res.text())

    let title = $('h1.product_name__name').text().trim()
    const nameMatch = title.match(/^(Filament Spectrum|Filament) (.+) ([\d\.]+)mm (.+ |)([\d\.]+)kg(| \(RAL (\d+)\))$/)
    if (!nameMatch) {
        console.error(`No match: ${title}`)
        return null
    }
    const diameter = nameMatch[3]
    const name = nameMatch[4].toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').trim()
    const weight = Number(nameMatch[5])*1000
    const ral = nameMatch[7]

    let images = []
    $('img.photos__photo[width="450"]').slice(0,2).map((_, el) => {
        images.push({ url: 'https://shop.spectrumfilaments.com'+$(el).attr('src') })
    })
    const ean = $('div[data-code="true"] span.dictionary__value_txt').text().trim()
    const sku = $('div[data-producer_code_extern="true"] span.dictionary__value_txt').text().trim()

    const out = {
        fid: await xfid(),
        name,
        images,
        sizes: {
            [`${diameter}mm/${weight}g`]: {
                link: item.url,
                ean,
                sku
            }
        }
    }
    if (ral) {
        out.color = { ral: 'RAL'+ral }
    }

    return out
    //let subtitle = $('h2.product-subtitle').text().trim()
}

async function crawlProduct (product, page = 1) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.shop)
    const $ = cheerio.load(await pg.text())

    const itemsEl = $('.product')
    if (itemsEl.length === 0) {
        return null
    }
    for (const itemEl of itemsEl) {
        const title = $(itemEl).find('a.product__name').text().trim()
        const url = $(itemEl).find('a.product__name').attr('href')

        const toProcess = []
        
        toProcess.push({ url })

        for (const item of toProcess) {
            const ret = await crawlDetail(product, item)
            if (!ret) {
                continue
            }

            let currentEan = ret.sizes[Object.keys(ret.sizes)[0]].ean
            if (Object.values(dbItem.variants || []).find(ov => Object.values(ov.sizes).find(os => os.ean === currentEan))) {
                continue
            }

            const exist = newItems.find(i => i.name === ret.name)
            if (exist) {
                const sizeExist = Object.values(exist.sizes).find(s => s.ean === ret.ean)
                if (sizeExist) {
                    continue
                }
                const sizeKey = Object.keys(ret.sizes)[0]
                exist.sizes[sizeKey] = JSON.parse(JSON.stringify(ret.sizes[sizeKey]))
                exist.images.push(...ret.images)

                /*if (!exist.images.map(i => i.url).includes(ret.images[0].url)) {
                    exist.images.push({ url: ret.images[0].url })
                }*/
                continue
            }

            newItems.push(ret)
        }
    }

    return null

    /*const match = html.match(/"productVariants":(\[[^\]]+\])/m)
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
    }*/
}


for (const p of bundle.materials.filter(m => m.vendor === 'spectrum')) {
    newItems = []
    if (!p.refs?.shop) {
        console.error(`no shop url: ${p.id}`)
        continue
    }
    const res = await crawlProduct(p)

    if (newItems.length > 0) {
        console.log(`----->>> [${p.id}] new items:`)
        console.log(yaml.dump({ variants: newItems }))
    }
}