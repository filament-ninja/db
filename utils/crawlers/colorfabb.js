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

    const materialName = html.match(/Material:<\/strong>&nbsp;<br>([^<]+)<\/td>/m)[1]
    const title = $('h1.page-title').text().trim().replace(new RegExp(materialName, 'i'), '')

    const name = title.replace(/^(PLA\/PHA)/, '').toLowerCase().trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').trim()
        .replace('Pla', 'PLA').replace('Allpha ','').replace(/^Varioshore Tpu/, '').replace(/^Varioshore /,'')
        .replace(/^Tpu (\d+)a /, '').replace(/^Petg Economy /,'')
    const images = [{url: $('img#placeholderImage').attr('src')}]

    const jsonConfig = JSON.parse(html.match(/"jsonConfig": ({.+})                }/m)[1])
    let sizes = {}
    const diameterParams = Object.values(jsonConfig.attributes)[0].options
    const weightParams = Object.values(jsonConfig.attributes)[1].options
    for (const s of diameterParams.map(o => o.label)) {
        const diameter = s.match(/^([\d\.]+) mm$/)[1]
        for (const w of weightParams.map(o => o.label)) {
            const weight = w.match(/^(\d+) gr$/)[1]
            sizes[`${diameter}mm/${weight}g`] = { link: item.url }
        }
    }

    const out = {
        fid: await xfid(),
        name,
        images,
        sizes
    }

    return out
}

async function crawlProduct (product, page = 1) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.web + '?p=' + page)
    const $ = cheerio.load(await pg.text())

    const itemsEl = $('.product-item')
    if (itemsEl.length === 0) {
        return null
    }
    for (const itemEl of itemsEl) {
        const url = $(itemEl).find('a.product-item-link').attr('href')
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

    return crawlProduct(product, page + 1)
}


for (const p of bundle.materials.filter(m => m.vendor === 'colorfabb')) {
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