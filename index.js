const DirectusSDK = require('@directus/sdk-js');
const fs = require('fs');
const path = require('path');
/**
 * Convert `const http` to variable to change protocol from project options
 */
let http = require(process.env.HTTP_SECURED === 'false' ? 'http' : 'https');
let directusClient;
/**
 * Default upload image path
 */
let uploadImagesDir = './static/images/.cms-cache'
const imageTypes = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp'
]
// TODO ADD CLEANUP OF UNUSED IMAGES / FILES
const download = async (url, dest, dir = uploadImagesDir) => {
	var imgName = dest;
	if (!fs.existsSync('./static')) {
		fs.mkdirSync('./static');
	}
	if (!fs.existsSync('./static/images')) {
		fs.mkdirSync('./static/images');
	}
	if (!fs.existsSync('./static/images/.cms-cache')) {
		fs.mkdirSync('./static/images/.cms-cache');
	}
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
	dest = dir + '/' + dest;
	var cleanImageName = path.resolve(dest);
	// if (fs.existsSync(dest)) return cleanImageName;
	console.log(' -- Downloading Resource: ' + imgName, url+'?download');
	const writer = fs.createWriteStream(cleanImageName);
	return new Promise((resolve, reject) => {
		try {
			directusClient.axios.get(url+'?potatoes', {responseType: 'stream'})
				.then((response) => response.data.pipe(writer))
				.catch(err=>{
					console.error(err)
					reject(err)
				})
			writer.on('finish', function () {
				console.log("Downloaded image :" + cleanImageName)
				resolve('./static/images/.cms-cache/'+imgName);
			});
			writer.on('error', function (err) {
        console.error(err)
        reject(err)
      });
		} catch (e) {
			console.error(e)
			reject(e)
		}
	});
};

async function sanitizeFields(fields, params = {}) {
	const {downloadImages, downloadFiles, apiUrl} = params;
	const sanitized = await Promise.all(Object.keys(fields).map(async (key) =>
		new Promise(async (resolve) => {
			if (fields[key] === null || fields[key] === undefined) {
				fields[key] = '';
			}
			if(Array.isArray(fields[key])){
				fields[key] = await Promise.all(fields[key].map(async (item) => new Promise(async (r) => {
					item = await sanitizeFields(item, params)
					r(item)
				})));
				return resolve(fields[key])
			}
			if (typeof fields[key] === 'object') {
				fields[key] = await sanitizeFields(fields[key], params)
			}
			if (downloadImages && fields[key] && fields[key].type && imageTypes.includes(fields[key].type)) {
				const imagePath = await download(apiUrl + 'assets/' + fields[key].id, fields[key].filename_download);
				console.log(imagePath)
				fields[key].gridsome_image = {
					"type": fields[key].type.split('/').shift(),
						"mimeType": fields[key].type,
						"src": imagePath,
						"size": {
						"width": fields[key].width,
							"height": fields[key].height
					},
					"sizes": `(max-width: ${fields[key].width}px) 100vw, ${fields[key].width}`,
						"srcset": [
							imagePath+"?width=480&fit=cover&blur=20&key=215a2f9 480w",
							imagePath+"?width=1024&fit=cover&blur=20&key=215a2f9 1024w",
							imagePath+"?width=2048&fit=cover&blur=20&key=215a2f9 2048w"
					],
						// "dataUri": "data:image/svg+xml,%3csvg fill='none' viewBox='0 0 2048 1365' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'%3e%3cdefs%3e%3cfilter id='__svg-blur-4ec14479b512767969be30dd9d849ccd'%3e%3cfeGaussianBlur in='SourceGraphic' stdDeviation='20'/%3e%3c/filter%3e%3c/defs%3e%3cimage x='0' y='0' filter='url(%23__svg-blur-4ec14479b512767969be30dd9d849ccd)' width='2048' height='1365' xlink:href='data:image/jpeg%3bbase64%2c/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAArAEADASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAABQQGAwcB/8QALxAAAgEDAwIEBQMFAAAAAAAAAQIDAAQRBRIhBjETIkFRBzJhcZEUgbEVI2Khwf/EABcBAQEBAQAAAAAAAAAAAAAAAAMBAgT/xAAdEQACAgMBAQEAAAAAAAAAAAAAAQIhETFRAxJB/9oADAMBAAIRAxEAPwCO/wDiheagxaOyhGTzvYsT%2bOKoHxE1MW%2bIYbGErgZYMxP1FeMadNMZgiZLYOAPtSj3csRZQ%2bGzyp%2b1Yl5x4L9Pp6za/EfV5r3CGzEW0uwMJwqqCWPfJ4FQXfX/AFJbTWkk0kaLPF%2boSPw1YFGzjdwMH6fzWF0W7Mena/PJ5misGVB35dlUn9hmu/SJ0zVluLHVZ7xb9o1S3uAd0Vsq5Azk5POc545oXBJuqQquOM2xq/8AiL1NOJU37Q6GMtHGqhQT3GOx%2btC33VPUFyqM13MWWA2%2bQcZQ98%2b5%2bvejdbaXTLm5s79LYT2%2bFZckZP0weeOc0BLPDPHJIktys4XIULlc%2b3elj5rhyy9JaYpe9SdSyho5NWu3DY4DkAY7dqz1yb5hiSeRwPdycV8W3uLjJUN9zxXeOzmhjJZxk8YzSVHRLexTTHfwyh8Hcw%2bb2FNJbR3sUamOBdpAaVMh29wfT/VAafcMDkNHnPcinUvYWt5FnmCgjaWjTDLnjjHrRSm9IZJO2cv6taPqzR30czxS4iknKhSq425OO4xz71nLW%2bSzMnjqX4IRg%2bOdwIyPUd/zUF622WRVI2g4Xb2xU3gliuzkkZIHpTpBvhsZbibq3V7uRbKR5JpDPNIEIES47Z5woA7VTfaI7W9vFHdRQiPJVgQCwPPNHdD9Ry9OOz2alZJOJJAfMV9sHj7VoZZNMvXe42ySNIdxOccnk8dh9q5/SThhLRcKVvYDNpMyeU6iXP3zmor3S7gLg3Tds4yOfrT11JppPhhZdwzjzHihri5jG4JIc/KCfapGcmVxQha9G60duLXI/wAXU/8Aaqv%2bmtVgsgxtJ/Idx/tk/wAVqLK5mCjEjfmrv1MzjY0r7W4I3elacXnOTaSPGdQtJInPY7jlQO5z6D3rtFpt7AVlFnM2DjyjcD%2bPStPq9jb299eSwoUlR/KwdsjPf1qSHV74tsefeoGAHVWx%2bRSNv8MY6Bx2rLbu7W8guSd8fpjHzKQfpz%2b9VaLNM9vcGNm2xsGwPXivnU1zKBEyvtMgIbaAM/ilNHRbfSrbwRt8VQz%2buSaz6XEiVkTXGIiWY7jzgj1o%2b6wrEhDsIBBz2NJ30jLOUGNpUZGBzyaPvQDGuR7UcaK%2bH//Z' /%3e%3c/svg%3e"
				};
			}
			resolve(fields[key])
		})
	))
	return fields;
}

async function sanitizeItem(fields, params) {
	let {id, title, slug, path, date, content, excerpt} = fields;
	let _id = fields._directusID || id.toString();
	delete fields.id;
	fields._directusID = _id;
	return sanitizeFields(fields, params);
}

/**
 * Convert nested object to flat object
 * https://stackoverflow.com/questions/34513964/how-to-convert-this-nested-object-into-a-flat-object
 * */
function traverseAndFlatten(currentNode, target, flattenedKey) {
	for (var key in currentNode) {
		if (currentNode.hasOwnProperty(key)) {
			var newKey;
			if (flattenedKey === undefined) {
				newKey = key;
			} else {
				newKey = flattenedKey + '__' + key;
			}
			var value = currentNode[key];
			if (typeof value === "object") {
				traverseAndFlatten(value, target, newKey);
			} else {
				target[newKey] = value;
			}
		}
	}
}

function flatten(obj) {
	var flattenedObject = {};
	traverseAndFlatten(obj, flattenedObject);
	return flattenedObject;
}

/**
 * End. https://stackoverflow.com/questions/34513964/how-to-convert-this-nested-object-into-a-flat-object
 * */

const checkForDownloads = async (item, apiUrl) =>{
	const result = await Promise.all(Object.keys(item).map(async (i) =>
		new Promise(async (resolve, reject) => {
			try {
				if (item[i] && item[i].type && item[i].data) {
					item[i].gridsome_link = await download(apiUrl + 'files/' + item[i].id, item[i].filename_download, './.cache-directus/file-cache');
				} else if (item[i] && i !== 'owner' && typeof item[i] === 'object' && Object.keys(item[i]).length > 0) {
					item[i] = await checkForDownloads(item[i], apiUrl);
				}
				resolve(item)
			} catch (e) {
				console.error(e)
				reject(e)
			}
		})
	));
	return result.pop();
}

class DirectusSource {
	static defaultOptions() {
		return {
			typeName: 'Directus',
			apiUrl: undefined,
			project: '_',
			staticToken: undefined,
			email: undefined,
			password: undefined,
			maxRetries: 3,
			reconnectTimeout: 10000,
			collections: []
		}
	}

	constructor(api, options) {
		this.api = api;
		this.options = options;
		/**
		 * Options for setting download protocol && images upload directory
		 */
		if (this.options.global) {
			if (this.options.global.protocol) {
				http = require(this.options.global.protocol)
			}
			if (this.options.global.uploadImagesDir) {
				uploadImagesDir = this.options.global.uploadImagesDir
			}
		}
		this.api.loadSource(args => this.fetchContent(args));
	}

	async fetchContent(store) {
		const {addCollection, getcollection, slugify} = store
		const {apiUrl, project, staticToken, email, password, collections, maxRetries, reconnectTimeout} = this.options
		const directusOptions = {
			url: apiUrl,
			project: project,
			token: staticToken,
		};
		directusClient = new DirectusSDK(apiUrl, directusOptions);
		let retries = 0;
		let connect = async () => {
			return new Promise(async (resolve, reject) => {
				try {
					await directusClient.auth.login(Object.assign({email, password}));
					resolve(await directusClient.collections.read());
				} catch (e) {
					console.error("DIRECTUS ERROR: Can not login to Directus", e);
					if (retries < maxRetries) {
						retries++;
						console.log("DIRECTUS - Retrying to connect in 10 seconds...");
						setTimeout(async () => {
							await connect();
						}, reconnectTimeout);
					} else {
						reject(process.exit(1))
						throw new Error("DIRECTUS ERROR: Can not login to Directus");
					}
				}
			});
		}
		if (email && password) {
			await connect();
		}
		console.log("DIRECTUS: Loading data from Directus at: " + apiUrl);
		if (collections.length <= 0) {
			console.error("DIRECTUS ERROR: No Directus collections specified!");
			process.exit(1)
			throw new Error("DIRECTUS ERROR: No Directus collections specified!");
		}
		for (const collection of collections) {
			let collectionName;
			let params;
			let directusPathName;
			if (typeof collection === 'object') {
				collectionName = collection.name;
				directusPathName = collection.directusPathName || collectionName
				delete collection.name;
				params = collection;
			} else {
				collectionName = collection;
			}
			try {
				if (!params.limit) {
					params.limit = -1;
				}
				const directusData = await directusClient.items(directusPathName).read(params);
				const data = directusData.data;
				let route;
				if (params) {
					if (params.hasRoute) {
						route = `/${slugify(collectionName)}/:slug`;
					} else if (params.route) {
						if (typeof params.route === 'function') {
							route = params.route(collectionName, collection, slugify);
						} else {
							route = params.route;
						}
					}
				}
				console.log("DIRECTUS: Adding collection: " + collectionName, route, params);
				const coll = addCollection({
					typeName: collectionName, // TODO change name creation
					route: route
				})
				// iterate over the data and return the modified content using promises
				await Promise.all(data.map(async (item) => new Promise(async (resolve) => {

					if (params.flat) {
						item = flatten(item);
					}
					const sanitizedItem =
						params.sanitizeID === false ? await sanitizeFields(item, {...this.options, ...params})
							: await sanitizeItem(item, {...this.options, ...params});
					coll.addNode(sanitizedItem)
					resolve()
				})));
			} catch (e) {
				console.error("DIRECTUS ERROR: Can not load data for collection '", e);
				process.exit(1)
				throw "DIRECTUS ERROR: Can not load data for collection '" + collectionName + "'!";
			}
		}
		console.log("DIRECTUS: Loading done!");
	}
}

module.exports = DirectusSource
