import fs from 'node:fs'
import yaml from 'js-yaml'
import { xfid } from '../xfid.js'
import * as cheerio from 'cheerio'

import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';

const fetch = NodeFetchCache.create({
  cache: new FileSystemCache(),
});

const bundle = JSON.parse(fs.readFileSync('./dist/index.json'))

async function crawlProduct (product) {
    const dbItem = bundle.materials.find(m => m.id === product.id)

    const handle = product.refs.web.replace(/^https:\/\/store.creality.com\/eu\/products\//,'')
    const pg = await fetch("https://crealityeu.myshopify.com/api/2024-10/graphql.json", {
        "credentials": "omit",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/json",
            "X-SDK-Variant": "storefront-api-client",
            "X-SDK-Version": "1.0.3",
            "X-Shopify-Storefront-Access-Token": "ceadcba9b59ca27cb14707e230f6e48a",
            "Sec-GPC": "1",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            "Priority": "u=4"
        },
        "referrer": "https://store.creality.com/",
        "body": `{\"query\":\"#graphql\\n  query Product(\\n    $country: CountryCode\\n    $handle: String!\\n    $language: LanguageCode\\n  ) @inContext(country: $country, language: $language) {\\n    product(handle: $handle) {\\n      ...Product\\n    }\\n  }\\n  #graphql\\n  fragment Product on Product {\\n    id\\n    title\\n    vendor\\n    handle\\n    productType\\n    options {\\n      id\\n      name\\n      optionValues {\\n        id\\n        name\\n      }\\n    }\\n    selectedVariant: selectedOrFirstAvailableVariant {\\n      ...ProductVariant\\n    }\\n    variants(first: 250) {\\n      nodes {\\n        ...ProductVariant\\n      }\\n    }\\n    ...ProductMetafields\\n  }\\n  #graphql\\n  fragment ProductVariant on ProductVariant {\\n    availableForSale\\n    compareAtPrice {\\n      amount\\n      currencyCode\\n    }\\n    id\\n    image {\\n      id\\n      url\\n      altText\\n      width\\n      height\\n    }\\n    price {\\n      amount\\n      currencyCode\\n    }\\n    product {\\n      title\\n      handle\\n      id\\n      vendor\\n      productType\\n      descriptionHtml\\n      description\\n      images (first: 10) {\\n        nodes {\\n          url\\n        }\\n      }\\n      accessoriesMetafield: metafield(key: \\\"accessories\\\", namespace: \\\"custom\\\") {\\n        id\\n        value\\n      }\\n      subtitleMetafield: metafield(key: \\\"subtitle\\\", namespace: \\\"custom\\\") {\\n        id\\n        value\\n      }\\n      shippingTimeMetafield: metafield(key: \\\"shippingtime\\\", namespace: \\\"custom\\\") {\\n        id\\n        value\\n      }\\n      buyPointMetafield: metafield(key: \\\"_buy_point\\\", namespace: \\\"custom\\\") {\\n        id\\n        value\\n      }\\n      activeHoverMetafield: metafield(key: \\\"hover_active\\\", namespace: \\\"custom\\\") {\\n        id\\n        value\\n      }\\n      shortTitleMetafield: metafield(key: \\\"short_title\\\", namespace: \\\"custom\\\") {\\n        id\\n        value\\n      },\\n      tagMetafield:metafield(key: \\\"newtag\\\", namespace: \\\"custom\\\") {\\n      id\\n      value\\n      }\\n    }\\n    selectedOptions {\\n      name\\n      value\\n    }\\n    sku\\n    title\\n    unitPrice {\\n      amount\\n      currencyCode\\n    }\\n    ...ProductVariantMetafields\\n  }\\n#graphql\\n  fragment ProductVariantMetafields on ProductVariant {\\n  labelMetafield: metafield(key: \\\"label\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  giftMetafield: metafield(key: \\\"gift\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  accessoryDescriptionMetafield: metafield(key: \\\"accessory_description\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n}\\n\\n  #graphql\\n  fragment ProductMetafields on Product {\\n  accessoriesMetafield: metafield(key: \\\"accessories\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  subtitleMetafield: metafield(key: \\\"subtitle\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  shippingTimeMetafield: metafield(key: \\\"shippingtime\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  buyPointMetafield: metafield(key: \\\"_buy_point\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  activeHoverMetafield: metafield(key: \\\"hover_active\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  shortTitleMetafield: metafield(key: \\\"short_title\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  },\\n  tagMetafield:metafield(key: \\\"newtag\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  breadcrumbsMetafield: metafield(key: \\\"product_series_breadcrumbs\\\", namespace: \\\"custom\\\") {\\n    id\\n    value\\n  }\\n  }\\n\\n\\n\",\"variables\":{\"handle\":\"${handle}\"}}`,
        "method": "POST",
        "mode": "cors"
    });
    
    const json = await pg.json()

    const newItems = []
    for (const node of json.data.product.variants.nodes) {
        
        //console.log(JSON.stringify(node, null, 2))
        //continue

        if (Object.values(dbItem.variants || []).find(ov => Object.values(ov.sizes).find(os => os.sku === node.sku))) {
            continue
        }
        
        newItems.push({
            fid: await xfid(),
            name: node.title.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            images: [
                { url: node.image.url }
            ],
            sizes: {
                '1.75mm/1000g': {
                    sku: node.sku,
                    link: product.refs.web,
                }
            }
        })
    }

    /*if (!match) {
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
    }*/
    if (newItems.length > 0) {
        console.log(`----->>> [${product.id}] new items:`)
        console.log(yaml.dump({ variants: newItems }))
    }
}

for (const p of bundle.materials.filter(m => m.vendor === 'creality')) {
    if (!p.refs?.web) {
        console.error(`no web: ${p.id}`)
        continue
    }
    await crawlProduct(p)
}