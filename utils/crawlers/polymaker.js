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
    //const res = await fetch(item.url)
    //const html = await res.text()
    //const $ = cheerio.load(html)

    const out = {
        fid: await xfid(),
        name: item.name,
        images: [{ url: item.image }],
        sizes: {
            [`${item.diameter}mm/${item.weight}g`]: { link: item.url, sku: item.sku, ean: item.ean }
        },
    }
    if (item.colorHex) {
        out.color = { hex: item.colorHex }
    }

    return out
}

async function searchProductUrl (item) {
    const searchUrl = `https://us.polymaker.com/search?options[prefix]=last&q=${item.sku}`
    const html = await (await fetch(searchUrl)).text()
    //console.log(searchUrl)
    const $ = cheerio.load(html)
    const results = $('product-card')
    if (results.length === 1) {
        const targetUrl = 'https://us.polymaker.com' + $(results[0]).find('a').attr('href')
        const targetHtml = await (await fetch(targetUrl)).text()
        const data = JSON.parse(targetHtml.match(/var __productWizRioProduct = ({.+});\n/m)[1])
        const variant = data.variants.find(v => v.sku === item.sku)

        if (!variant) {
            console.error(`Variant not found!! ${item.sku} {name:${item.name}}`)
            return null
        }
        const colorHex = variant.option3.match(/HEX Code - \⌗([a-zA-Z0-9]{6})/m)

        return {
            ...item,
            url: `${targetUrl}?variant=${variant.id}`,
            colorHex: colorHex ? '#'+colorHex[1] : null,
        }
    }
    return null
}

async function crawlProduct (product, page = 1) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.web)
    const $ = cheerio.load(await pg.text())

    /*let isLast = false
    const nextPg = $('ul.pagination.FiltersPaging li.next')
    if (nextPg.length === 0) {
        isLast = true
    }*/

    const itemsEl = $('div.color-range-sku-cell')
    if (itemsEl.length === 0) {
        return null
    }

    for (const itemEl of itemsEl) {

        const sku = $(itemEl).find('.sku-spool-meta-wrapper:nth-child(1) .sku-spool-meta').text().trim()
        if (!sku) {
            throw new Error(`Sku not found`)
        }
        const ean = $(itemEl).find('.sku-spool-meta-wrapper:nth-child(2) .sku-spool-meta').text().trim()
        const name = $(itemEl).find('.sku-spool-meta-wrapper:nth-child(3) .sku-spool-meta').text().trim()
        const diameter = Number($(itemEl).find('.sku-spool-meta-wrapper:nth-child(4) .sku-spool-meta').text().trim().replace('mm',''))
        const weightBase = $(itemEl).find('.sku-spool-meta-wrapper:nth-child(5) .sku-spool-meta').text().trim()
        const weight = Number(weightBase.match(/^([\d\.]+)kg$/)[1]) * 1000
        const image = $(itemEl).find('img.color-range-sku-image.ct-image').attr('data-src')

        let src = { sku, ean, name, diameter, weight, image }
        let out = await searchProductUrl(src)
        //console.log(out)
        if (!out) {
            console.error(`Product not found: ${product.name} --- ${name} [${sku}]`)
            out = src
        }

        const toProcess = []
        toProcess.push(out)

        for (const item of toProcess) {
            const ret = await crawlDetail(product, item)
            if (!ret) {
                continue
            }

            if (Object.values(dbItem.variants || []).find(ov => Object.values(ov.sizes).find(os => os.sku === item.sku))) {
                continue
            }
            /*if (newItems.find(v => v.images[0].url === ret.images[0].url)) {
                return null
            }*/

            const exist = newItems.find(i => i.name === ret.name)
            if (exist) {
                const sizeExist = Object.values(exist.sizes).find(s => s.sku === ret.sku)
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
    /*if (isLast) {
        return null
    }
    return crawlProduct(product, page + 1)*/
}


for (const p of bundle.materials.filter(m => m.vendor === 'polymaker')) {
    newItems = []
    if (!p.refs?.web) {
        console.error(`no web url: ${p.id}`)
        continue
    }
    const res = await crawlProduct(p)

    if (newItems.length > 0) {
        console.log(`----->>> [${p.id}] new items:`)
        console.log(yaml.dump({ variants: newItems }))
    }
}