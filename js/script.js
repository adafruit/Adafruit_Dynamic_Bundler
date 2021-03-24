/* global JSZipUtils */
/* global JSZip */
'use strict';

// Defaults that can be overridden by parameters
var modules = [];
var bundleType = "mpy6";
var bundle = "Adafruit_CircuitPython_Bundle";

// Variables that likely change based on above variables
var release;
var bundleName;
var bundleFile;
var remoteFolder;

const validBundles = ["Adafruit_CircuitPython_Bundle", "CircuitPython_Community_Bundle"];
var bundlePrefix;
const libRoot = "lib/";
const promises = [];
const bundleTypes = {
  "mpy6": {
    "identifier": "6.x-mpy",
    "fileExtension": ".mpy"
  },
  "py": {
    "identifier": "py",
    "fileExtension": ".py"
  },
}

var packages = [];
var outputZip = new JSZip();
var bundleContents;

async function getBundleContents() {
  await getLatestRelease();
  const jsonFile = remoteFolder + bundlePrefix + '-' + release + '.json';
  console.log(jsonFile);
  var response = await fetch(jsonFile);
  return await response.json();
}

async function getLatestRelease() {
  const response = await fetch('https://api.github.com/repos/adafruit/' + bundle + '/releases/latest');
  const data = await response.json();
  
  release = data.tag_name;
  bundleName = bundlePrefix + "-" + bundleTypes[bundleType].identifier + "-" + release;
  remoteFolder = 'https://github.com/adafruit/' + bundle + '/releases/download/' + release + '/';
  bundleFile = bundleName + ".zip";
  
  return data.tag_name;
}

async function copyFile(location, inputZip, outputZip) {
  var zipFile = await inputZip.file(location).async("uint8array");
  if (zipFile !== null) {
    console.log("Adding " + location);
    await outputZip.file(location, zipFile);
  } else {
    console.log("Error: " + location + "not found!")
  }
}

function getDependencies(moduleKey) {
  var foundModules = [];
  if (bundleContents != undefined) {
    for(var item in bundleContents) {
      if (item == moduleKey) {
        if (bundleContents[item].package) {
          foundModules.push(bundleContents[item].path);
        } else {
          foundModules.push(bundleContents[item].path + bundleTypes[bundleType].fileExtension);
        }
        for(var dependencyKey in bundleContents[item].dependencies) {
          foundModules = foundModules.concat(getDependencies(bundleContents[item].dependencies[dependencyKey]));
        }
      }
    }
  }
  
  return foundModules;
}

function getModules(module) {
  var foundModules = [];
  if (bundleContents != undefined) {
    for(var item in bundleContents) {
      if (bundleContents[item].path === libRoot + module) {
        foundModules = foundModules.concat(getDependencies(item));
      }
    }
  }

  return foundModules;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Process get params
  var getParams = {}
  location.search.substr(1).split("&").forEach(function(item) {getParams[item.split("=")[0]] = item.split("=")[1]})
  if (getParams["libs"] !== undefined) {
    modules = getParams["libs"].split(",");
  }
  if (getParams["type"] !== undefined) {
    if (Object.keys(bundleTypes).indexOf(getParams["type"]) >= 0) {
      bundleType = getParams["type"];
    }
  }
  if (getParams["bundle"] !== undefined) {
    if (validBundles.indexOf(getParams["bundle"]) >= 0) {
      bundle = getParams["bundle"];
    }
  }

  bundlePrefix = bundle.toLowerCase().replace(/_/g, "-");
  
  /*
  To Do:
  Print a message if no libs supplies
  It should show which options are allowed

  Options
  libs
  bundle
  type: defaults to mpy
  */

  bundleContents = await getBundleContents();
  
  // Search for modules in bundleContents (probably recursively)
  for(var moduleKey in modules) {
    packages = packages.concat(getModules(modules[moduleKey]));
  }

  // Remove Duplicates
  packages = packages.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
  
  console.log(packages);
  
  new JSZip.external.Promise(function (resolve, reject) {
    JSZipUtils.getBinaryContent(remoteFolder + bundleFile, function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  }).then(function (data) {
      return JSZip.loadAsync(data);
  }).then(async function(zipContents) {
    for(var packageKey in packages) {
      var zipItem;
      if (packages[packageKey].substr(-1 * (bundleTypes[bundleType].fileExtension.length)) !== bundleTypes[bundleType].fileExtension) {
        var zipFolder = zipContents.folder(bundleName + "/" + packages[packageKey]);
        if (zipFolder !== null) {
          zipFolder.forEach(function(relativePath, file) {
            promises.push(copyFile(file.name, zipContents, outputZip));
          });
        }
      } else {
        promises.push(copyFile(bundleName + "/" + packages[packageKey], zipContents, outputZip));
      }
    }

    Promise.all(promises).then(function (data) {
      console.log("Final Output");
      console.log(outputZip.files);
      if (Object.keys(outputZip.files).length > 0) { 
        outputZip.generateAsync({type:"base64"}).then(function (base64) {
            //window.location = "data:application/zip;base64," + base64;
        }, function (err) {
            console.log(err);
        });
      }
    });
  });
});
