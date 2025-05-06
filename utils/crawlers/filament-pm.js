import fs from 'node:fs'
import yaml from 'js-yaml'
import { xfid } from '../xfid.js'
import * as cheerio from 'cheerio'
import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';

const fetch = NodeFetchCache.create({
  cache: new FileSystemCache(),
});

const bundle = JSON.parse(fs.readFileSync('./dist/index.json'))


function getProperty ($, key) {
    const labelElement = $(`td.product-parameters-table-name:contains("${key}")`);
    const valueElement = labelElement.next('td');

    // Extract the text
    const rval = valueElement.text().trim()
    if (rval === 'can not be specified') {
        return null
    }
    return rval
}

async function crawlDetail (product, item) {
    const res = await fetch(item.url)
    const $ = cheerio.load(await res.text())

    let title = $('h1.product-title').text().trim()
    let subtitle = $('h2.product-subtitle').text().trim()
    
    let diameter, weight;
    const stMatch = subtitle.match(/^([\d\.]+) mm; ([\d\.]+) kg$/)
    if (stMatch) {
        diameter = stMatch[1]
        weight = stMatch[2]
    } else {
       console.error(`subtitle cannot be parsed: ${item.url}`)
       return null
    }

    if (Number(weight) < 10) {
        weight = weight*1000
    }
    if (!["1.75","2.85"].includes(diameter)) {
        throw new Error(`unknown diameter: ${diameter}`)
    }

    if (product.id === 'filament-pm-pla') {
        title = title.replace(/^PLA - /, '').replace(/^PLA /, '')
    }
    if (product.id === 'filament-pm-pla-plus') {
        title = title.replace(/^PLA\+ /, '')
    }
    if (product.id === 'filament-pm-petg') {
        if (title.match(/(CFJet|FRJet)/)) {
            // this we process separately
            return null
        }

        title = title.replace(/^PETG - /, '').replace(/PETG /, '')
    }
    if (product.id === 'filament-pm-silk') {
        title = title.replace(/^SILK - /, '').replace(/SILK /, '')
    }
    if (product.id === 'filament-pm-abs') {
        title = title.replace(/^ABS - /, '').replace(/ABS /, '')
    }
    if (product.id === 'filament-pm-asa') {
        title = title.replace(/^ASA - /, '').replace(/ABS /, '')
    }
    if (product.id === 'filament-pm-pc-abs') {
        title = title.replace(/^PC\/ABS - /, '').replace(/PC\/ABS /, '')
    }
    if (product.id === 'filament-pm-abs-t') {
        title = title.replace(/^ABS-T - /, '').replace(/ABS-T /, '')
    }
    if (product.id === 'filament-pm-pa-cfjet') {
        title = title.replace(/^PA-CFJet - /, '')
    }
    if (product.id.match(/^filament-pm-tp[eu]-/)) {
        title = title.replace(/^TP[EU] \d+ - /, '').replace(/TP[EU] \d+ /, '')
    }
    if (product.id === 'filament-pm-ultem') {
        title = title.replace(/PEIJet 1010 Ultem - /, '')
    }
    if (product.id.match(/^filament-pm-petg-(cfjet|frjet)/)) {
        title = title.replace(/^PETG (CFJet Carbon|FRJet self-extinguishing) - /, '')
    }

    title = title.replace(' - glowing in the dark', '')

    const out = {
        fid: await xfid(),
        name: title,
        color: {},
        images: [
            { url: item.img }
        ],
        sizes: {
            [`${diameter}mm/${weight}g`]: {
                link: item.url,
                ean: $('#snippet--info td[itemprop="gtin13"]').text().trim()
            }
        }
    }

    const ral = getProperty($, 'RAL')
    const pantone = getProperty($, 'Pantone')

    if (ral) {
        out.color.ral = `RAL${ral}`
    }
    if (pantone) {
        out.color.pantone = pantone
    }


    return out
}

let newItems = []

async function crawlProduct (product, page = 1) {
    const dbItem = bundle.materials.find(m => m.id === product.id)
    const pg = await fetch(product.refs.web + '/' + page)
    const html = await pg.text()
    const $ = cheerio.load(html)

    if ($('.product').length === 0) {
        return false
    }
    
    const toProcess = []
    $('.product').each((index, element) => {

        const cu = $(element)
        toProcess.push({
            name: cu.find('h2[itemprop="name"]').text().trim(),
            url: 'https://shop.filament-pm.com'+cu.find('a[itemprop="url"]').attr('href'),
            img: cu.find('img').attr('data-lazy'),
        })
    })


    for (const item of toProcess) {
        const ret = await crawlDetail(product, item)
        if (!ret) {
            continue
        }

        if (Object.values(dbItem.variants || []).find(ov => ov.name === ret.name)) {
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

            if (!exist.images.map(i => i.url).includes(ret.images[0].url)) {
                exist.images.push({ url: ret.images[0].url })
            }
            continue
        }
        newItems.push(ret)
    }

    return crawlProduct(product, page + 1)
}

for (const p of bundle.materials.filter(m => m.vendor === 'filament-pm')) {
    newItems = []
    if (!p.refs?.web) {
        console.error(`no web: ${p.id}`)
        continue
    }
    const res = await crawlProduct(p)

    if (newItems.length > 0) {
        console.log(`----->>> [${p.id}] new items:`)
        console.log(yaml.dump({ variants: newItems }))
    }
}