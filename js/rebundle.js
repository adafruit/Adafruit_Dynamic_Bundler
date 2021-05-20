/* global JSZipUtils */
/* global JSZip */
'use strict';

// Defaults that can be overridden by parameters
var modules = [];
var bundleType = "6mpy";
var bundle = "adafruit";
var includeDependencies = true;

// Variables that likely change based on above variables
var release;
var bundleName;
var bundleFile;

const bundleConfig = {
  "adafruit": {
    "remoteFolder": "https://adafruit-circuit-python.s3.amazonaws.com/bundles/adafruit/",
    "repoName": "Adafruit_CircuitPython_Bundle"
  },
  "community": {
    "remoteFolder": "https://adafruit-circuit-python.s3.amazonaws.com/bundles/community/",
    "repoName": "CircuitPython_Community_Bundle"
  }
}
var bundlePrefix;
const promises = [];
const bundleTypes = {
  "6mpy": {
    "identifier": "6.x-mpy",
    "fileExtension": ".mpy"
  },
  "7mpy": {
    "identifier": "7.x-mpy",
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
  const jsonFile = bundleConfig[bundle].remoteFolder + bundlePrefix + '-' + release + '.json';
  var response = await fetch(jsonFile);

  bundleContents = await response.json();
}

async function getLatestRelease() {
  const response = await fetch('https://api.github.com/repos/adafruit/' + bundleConfig[bundle].repoName + '/releases/latest');
  const data = await response.json();
  release = data.tag_name;
  bundleName = bundlePrefix + "-" + bundleTypes[bundleType].identifier + "-" + release;
  bundleFile = bundleName + ".zip";

  return data.tag_name;
}

async function copyFile(location, inputZip, outputZip) {
  var zipFile = await inputZip.file(location).async("uint8array");
  if (zipFile !== null) {
    //console.log("Adding " + location);
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
        if (includeDependencies) {
          for(var dependencyKey in bundleContents[item].dependencies) {
            foundModules = foundModules.concat(getDependencies(bundleContents[item].dependencies[dependencyKey]));
          }
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
      if (item === module) {
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
    if (Object.keys(bundleConfig).indexOf(getParams["bundle"]) >= 0) {
      bundle = getParams["bundle"];
    }
  }
  if (getParams["deps"] !== undefined) {
    includeDependencies = getParams["deps"] != "0" && getParams["deps"].toLowerCase() != "false";
  }

  bundlePrefix = bundleConfig[bundle].repoName.toLowerCase().replace(/_/g, "-");

  /*
  To Do:
  Print a message if no libs supplies
  It should show which options are allowed

  Maybe a bundle creator screen
  Maybe use the API instead of directly querying

  Make use of Multiple Library Dependencies (Could slow things down a bit)
  */

  await getBundleContents();

  // Search for modules in bundleContents (probably recursively)
  for(var moduleKey in modules) {
    packages = packages.concat(getModules(modules[moduleKey]));
  }

  // Remove Duplicates
  packages = packages.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);

  console.log(packages);

  fetch(bundleConfig[bundle].remoteFolder + bundleFile)
  .then(async function (response) {
      if (response.status === 200 || response.status === 0) {
          return Promise.resolve(response.blob());
      } else {
          return Promise.reject(new Error(response.statusText));
      }
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
      //console.log("Final Output");
      //console.log(outputZip.files);
      if (Object.keys(outputZip.files).length > 0) {
        outputZip.generateAsync({type:"base64"}).then(function (base64) {
            window.location = "data:application/zip;base64," + base64;
        }, function (err) {
            console.log(err);
        });
      }
    });
  });
});
