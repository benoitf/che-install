#!/usr/bin/env node
var DEFAULT_DOCKERFILE_CONTENT = 'FROM codenvy/ubuntu_jdk8';
var DEFAULT_HOSTNAME = '192.168.65.2';
var debug = false;
var times = 10;

// gloabl var
var waitDone = false;
var che = {};
che.hostname = DEFAULT_HOSTNAME;
var dockerContent;

// requirements
var path = require('path');
var http = require('http');
var fs = require('fs');
var vm = require('vm');
var readline = require('readline');
var spawn = require('child_process').spawn
var exec = require('child_process').exec;

// polyfill
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function (searchString, position) {
    position = position || 0;
    return this.substr(position, searchString.length) === searchString;
  };
}

// init folder/files variables
var currentFolder = path.resolve('./');
var folderName = path.basename(currentFolder);
var cheFile = path.resolve(currentFolder, 'chefile');
var dotCheFolder = path.resolve(currentFolder, '.che');
var confFolder = path.resolve(dotCheFolder, 'conf');
var workspacesFolder = path.resolve(dotCheFolder, 'workspaces');
var chePropertiesFile = path.resolve(confFolder, 'che.properties');

var mode;
var args = process.argv.slice(2);
if (args.length == 0) {
  console.log('only init and up commands are supported.');
  return;
} else if ('init' === args[0]) {
  init();
} else if ('up' === args[0]) {
  up();
} else {
  console.log('Invalid arguments ' + args +': Only init and up commands are supported.');
  return;
}


function parse() {

    try {
        fs.statSync(cheFile);
        // we have a file
    } catch (e) {
        console.log('No chefile defined, use default settings');
        return;
    }

    // load the chefile script if defined
    var script_code = fs.readFileSync(cheFile);

    // setup the bindings for the script
    che.server =  {};
    che.server.ip = hostname;

    // create sandboxed object
    var sandbox = { "che": che, "console": console};

    var script = vm.createScript(script_code);
    script.runInNewContext(sandbox);

    console.log('Che file parsing object is ', che);
}


function init() {
  // needs to create folders
  initCheFolders();
  setupConfigFile();

  console.log('Che configuration initialized in ' + dotCheFolder );
}

function up() {
    parse();

    // test if conf is existing
    try {
        var statsPropertiesFile = fs.statSync(chePropertiesFile);
    } catch (e) {
        console.log('No che configured. che init has been done ?');
        return;
    }

    console.log('Starting che');
    // needs to invoke docker run
    cheBoot();

    dockerContent = getDockerContent();

    // loop to check startup (during 30seconds)
    waitCheBoot();
}

function getDockerContent() {
  // build path to the Dockerfile in current directory
  var dockerFilePath = path.resolve('./Dockerfile');

  // use synchronous API
  try {
    stats = fs.statSync(dockerFilePath);
    console.log('Using a custom project Dockerfile \'' + dockerFilePath + '\' for the setup of the workspace.');
    var content = fs.readFileSync(dockerFilePath, 'utf8');
    return content;
  } catch (e) {
    // file does not exist, return default
    return DEFAULT_DOCKERFILE_CONTENT;
  }
}


// Create workspace based on the remote hostname and workspacename
// if custom docker content is provided, use it
function createWorkspace(remoteHostname, workspaceName, dockerContent) {
  var options = {
    hostname: remoteHostname,
    port: 8080,
    path: '/api/workspace?account=',
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8'
    }
  };
  var req = http.request(options, function(res) {
    res.on('data', function (body) {

      if (res.statusCode == 201) {
        // workspace created, continue
        displayUrlWorkspace(JSON.parse(body));
      } else {
        // error
        console.log('Invalid response from the server side. Aborting');
        console.log('response was ' + body);
      }
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });

  var workspace = {
    "defaultEnv": "default",
    "commands": [],
    "projects": [],
    "environments": [{
      "machineConfigs": [{
        "dev": true,
        "servers": [],
        "envVariables": {},
        "limits": {"ram": 2500},
        "source": {"type": "dockerfile", "content": dockerContent},
        "name": "default",
        "type": "docker",
        "links": []
      }], "name": "default"
    }],
    "name": workspaceName,
    "links": [],
    "description": null
  };


  req.write(JSON.stringify(workspace));
  req.end();

}

function displayUrlWorkspace(workspace) {

  var found = false;
  var i = 0;
  var links = workspace.links;
  while (i < links.length && !found) {
    // display the ide url link
    var link = links[i];
    if (link.rel === 'ide url') {
      found = true;
      console.log('Open browser to ' + link.href);
      //spawn('open', [link.href]);
    }
    i++;

  }

  if (!found) {
    console.log('Workspace successfully started but unable to find workspace link');
  }


}


function initCheFolders() {

  // create .che folder
  try {
    fs.mkdirSync(dotCheFolder, 0744);
  } catch (e) {
    // already exist
  }

  // create .che/workspaces folder
  try {
    fs.mkdirSync(workspacesFolder, 0744);
  } catch (e) {
    // already exist
  }

  // create .che/conf folder

  try {
    fs.mkdirSync(confFolder, 0744);
  } catch (e) {
    // already exist
  }


  // copy configuration file

  try {
    stats = fs.statSync(chePropertiesFile);
  } catch (e) {
    // file does not exist, copy it
    fs.writeFileSync(chePropertiesFile, fs.readFileSync(path.resolve(__dirname, 'che.properties')));
  }

}


function setupConfigFile() {
  // need to setup che.properties file with workspaces folder

  // update che.user.workspaces.storage
  updateConfFile('che.user.workspaces.storage', workspacesFolder);

  // update extra volumes
  updateConfFile('machine.server.extra.volume', currentFolder + ':/projects/' + folderName);

}


function updateConfFile(propertyName, propertyValue) {

  var content = '';
  var foundLine = false;
  fs.readFileSync(chePropertiesFile).toString().split('\n').forEach(function (line) {

    var updatedLine;



    if (line.startsWith(propertyName)) {
      foundLine = true;
      updatedLine = propertyName + '=' + propertyValue + '\n';
    } else {
      updatedLine = line  + '\n';
    }

    content += updatedLine;
  });

  // add property if not present
  if (!foundLine) {
    content += propertyName + '=' + propertyValue + '\n';
  }

  fs.writeFileSync(chePropertiesFile, content);

}


function cheBoot() {
  var child = exec('docker run -p 8080:8080' +
      ' -p 8000:8000' +
      ' --name che' +
      ' -v /var/run/docker.sock:/var/run/docker.sock' +
      ' -v ' + workspacesFolder + ':' + workspacesFolder +
      ' -v ' + currentFolder + ':' + workspacesFolder + '/local/' + folderName +
      ' -v ' + confFolder + ':/container -e CHE_LOCAL_CONF_DIR=/container' +
      ' codenvy/che:nightly' +
      ' --remote:' + che.hostname , function callback(error, stdout, stderr) {
    console.log('error is' + error);
      }
  );

  if (debug) {
    child.stdout.on('data', function (data) {
      console.log('Che::' + data.toString());
    });
  }

}


// test if can connect on port 8080
function waitCheBoot() {

  if(times < 1) {
    return;
  }
  //console.log('wait che on boot', times);
  var options = {
    hostname: che.hostname,
    port: 8080,
    path: '/api/workspace',
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8'
    }
  };
  var req = http.request(options, function(res) {
    res.on('data', function (body) {

      if (res.statusCode === 200 && !waitDone) {
        waitDone = true;
        createWorkspace(che.hostname, 'local', dockerContent);
      }
    });
  });
  req.on('error', function(e) {
    if (debug) {
      console.log('with request: ' + e.message);
    }
  });


  req.end();


  times--;
  if (times > 0 && !waitDone) {
    setTimeout(waitCheBoot, 5000);
  }


}
