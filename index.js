#!/usr/bin/env node

const program  = require('commander');
const request  = require('superagent');
const fs       = require('fs');
const Throttle = require('superagent-throttle')

let throttle = new Throttle({
    active: true,     // set false to pause queue
    rate: 40,          // how many requests can be sent every `ratePer`
    ratePer: 1000,   // number of ms in which `rate` requests may be sent
    concurrent: 20     // how many requests can be sent concurrently
})

function uploadFile(program, file, path) {

    var req = request
        .post(program.server+'/cache')
        .use(throttle.plugin())
        .set('Accept', 'application/json')
        .attach('file', file)
        .field('path', path);

    if (typeof program.resize !== 'undefined') {
        req = req.field("scale",program.resize);
    }

    req.end(function (err, res) {
        if (err || !res.ok) {
            console.error('Error: %s in file %s',err.message,file);
        } else {
            //console.log("response: ", JSON.stringify(res.body));
            if (typeof res.body.width === 'undefined') {
                //not image
                console.log("%s\t%s", res.body.id, path);
            } else {
                //image
                console.log("%s\t%s\t%sx%s",res.body.id,path,res.body.width,res.body.height);
                if (typeof res.body.scaled !== 'undefined') {
                    for(i=0;i<res.body.scaled.length;i++) {
                        console.log("%s\t%s\t%sx%s",res.body.scaled[i].id,path,res.body.scaled[i].width,res.body.scaled[i].height);
                    }
                }
            }

        }
    });
}

function uploadDirectory(program, root, directory) {
    var dirpath = root;
    if (directory) {
        dirpath += "/" + directory;
    }
    //console.log("path", dirpath);
    fs.readdir(dirpath, function(err, files) {
        for (i=0; i<files.length; i++) {
            //console.log("file",files[i]);
            var filepath = dirpath+"/"+files[i];
            //console.log("filepath",filepath);
            var filestat = fs.statSync(filepath);

            if (filestat && filestat.isFile()) {
                var path = filepath.replace(root+"/","");
                //console.log("uploading file",path);
                uploadFile(program,filepath,path);
            }
            else if (filestat && filestat.isDirectory()) {
                var path = filepath.replace(root+"/","");
                //console.log("uploading directory",path);
                uploadDirectory(program,root,path);
            }
        }
    });
}

program
    .version('0.0.1')
    .arguments('<path>')
    .option('-s, --server <server>', 'the destination server, default: http://localhost:8080')
    .option('-r, --resize <resize>', 'create resized images, can use: (<width>x</height>)(,<width>x</height>)*, i.e: 120x120 will create a thumbnail')
    .action(function(path) {
        if (typeof program.server === 'undefined') {
            program.server = 'http://localhost:8080';
        }
        if (typeof path === 'undefined') {
            console.error('no file given!');
            process.exit(1);
        }
        var status = fs.statSync(path);

        if (typeof status === 'undefined') {
            console.error('path "%s" does not exist', path);
            process.exit(1);
        }

        if (status.isFile()) {
            console.log('Starting upload');
            console.log('==============================');
            console.log('Server: %s', program.server);
            console.log('File  : %s', path);
            if (typeof program.resize !== 'undefined') {
                console.log('images will be scaled to', program.resize);
            }
            console.log('==============================');
            uploadFile(program, path, path);
        }
        else if (status.isDirectory()) {
            console.log('Starting upload');
            console.log('==============================');
            console.log('Server   : %s', program.server);
            console.log('Directory: %s', path);
            if (typeof program.resize !== 'undefined') {
                console.log('Resize   :', program.resize);
            }
            console.log('==============================');
            uploadDirectory(program, path);
        }
    })
    .parse(process.argv);

