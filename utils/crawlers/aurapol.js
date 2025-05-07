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
    const html = await res.text()
    const $ = cheerio.load(html)

    const title = $('h1.pb-0').text().trim()
    const nameMatch = title.match(/^AURAPOL (.+) 3D Filament (.+) ([\d\.,]+)\s?k?g ([\d\.,]+) mm-?$/)
    if (!nameMatch) {
        console.error(`Cannot parse: ${title}`)
        return null
    }
    const material = nameMatch[1]
    const name = nameMatch[2]
    const weightBase = Number(nameMatch[3].replace(',', '.'))
    const weight = weightBase < 10 ? (weightBase * 1000) : weightBase
    //console.log(weight)
    const diameter = nameMatch[4].replace(',', '.')
    const images = [{ url: $('img.img-thumbnail').attr('src') }]

    const labelElement = $(`table th span:contains("Color")`);
    const valueElement = labelElement.parent().next('td');
    const ralMatch = valueElement.text().trim().match(/^RAL\s*(\d+)/)
    let ral = ralMatch ? 'RAL'+ralMatch[1] : null

    const skuElement = $('div.row > div:contains("Product code")')
    const sku = skuElement.next('div').text().trim()

    const out = {
        fid: await xfid(),
        name,
        images,
        sizes: {
            [`${diameter}mm/${weight}g`]: { link: item.url, sku }
        },
    }
    if (ral) {
        out.color = { ral }
    }

    return out
}

async function crawlProduct (product, page = 1) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.web + '/pg-' + page)
    const $ = cheerio.load(await pg.text())

    let isLast = false
    const nextPg = $('ul.pagination.FiltersPaging li.next')
    if (nextPg.length === 0) {
        isLast = true
    }

    const itemsEl = $('article.card-item')
    if (itemsEl.length === 0) {
        return null
    }
    for (const itemEl of itemsEl) {
        const url = 'https://www.aurapol.com' + $(itemEl).find('a.img-center').attr('href')
        const toProcess = []
        toProcess.push({ url })

        for (const item of toProcess) {
            const ret = await crawlDetail(product, item)
            if (!ret) {
                continue
            }

            let currentSku = ret.sizes[Object.keys(ret.sizes)[0]].sku
            if (Object.values(dbItem.variants || []).find(ov => Object.values(ov.sizes).find(os => os.sku === currentSku))) {
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
    if (isLast) {
        return null
    }
    return crawlProduct(product, page + 1)
}


for (const p of bundle.materials.filter(m => m.vendor === 'aurapol')) {
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