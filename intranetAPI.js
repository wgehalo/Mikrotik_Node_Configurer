const jsdom = require('jsdom');
const httpntlm = require('httpntlm');

const postOptions = {
  url: 'http://vhost/intranet/main.php',
  username: null,
  password: null,
  workstation: 'mikrotik.automater',
  domain: 'USAGINC',
};

function buildPostParams(argsArray) {
  const postParameters = {
    ajaxfunc: 'ajax_writemodule',
    ajaxretfunc: 'writemodule',
    ajaxrnd: new Date().getTime(),
  };
  for (let i = 0; i < argsArray.length; i += 1) {
    postParameters[`ajaxargs[${i}]`] = argsArray[i];
  }
  return postParameters;
}

function fixHTML(rawHTML) {
  // This converts the raw character codes and fixes duplicate quotations.
  let fixedHTML = rawHTML.replace(/&#(\d+);/g, (match, p1) => String.fromCharCode(p1));
  fixedHTML = fixedHTML.replace(/\\(['"])/g, '$1');
  return fixedHTML;
}

function getManjobHTML(manjobNumber, manjobLocation, cb) {
  let neededFunction = null;
  switch (manjobLocation) {
    case 'Open':
      neededFunction = 'processopenmanufacturing';
      break;
    case 'Pulled':
      neededFunction = 'processinprocessmanufacturing';
      break;
    case 'Started':
      neededFunction = 'processstartedmanufacturing';
      break;
    case 'Completed':
      neededFunction = 'completedmanufacturejob';
      break;
    default:
      neededFunction = 'processstartedmanufacturing';
      cb = manjobLocation;
  }

  postOptions.parameters = buildPostParams([neededFunction, 'topmodule', manjobNumber]);
  httpntlm.post(postOptions, (err, res) => {
    let body;
    if (err) throw err;
    if (cb) {
      body = fixHTML(res.body);
      jsdom.env(body, (err2, window) => {
        if (err2) throw err2;
        if (cb) cb(window);
      });
    }
  });
}

function getManjobNotes(manjobNumber, cb) {
  getManjobHTML(manjobNumber, 'Started', (window) => {
    let notes = (window.document.getElementsByName('notes')[0].value);
    notes = notes.replace(/(\\r)?\\n/g, String.fromCharCode(10)); // This makes all newlines the same.
    if (cb) cb(notes);
  });
}

exports.appendManjobNotes = function appendManjobNotes(manjobNumber, newText, cb) {
  if (!postOptions.username || !postOptions.password) {
    if (cb) cb('No username or password set.');
  } else {
    getManjobNotes(manjobNumber, (rawnotes) => {
      const notes = `${rawnotes}\n\n\n${newText}`;
      postOptions.parameters = buildPostParams(['editmanufacturingnotes', 'manufacturingnotesmod', manjobNumber, notes]);
      httpntlm.post(postOptions, (err, res) => {
        if (cb) cb(err, res);
      });
    });
  }
};

exports.updatePartQty = function updatePartQty(manjobNumber, partSku, qty, cb) {
  postOptions.parameters = buildPostParams(['updatemanufacturingparts', 'builditemsmodule', manjobNumber, partSku, qty]);
  let body;
  httpntlm.post(
    postOptions
    , (err, res) => {
      if (err) throw err;
      if (cb) {
        body = res.body.replace(/&#(\d+);/g, (match, p1) => String.fromCharCode(p1));
        body = body.replace(/\\(['"])/g, '$1');
        cb(res);
      }
    });
};

exports.getInventoryCount = function getInventoryCount(cb) {
  // returns a JSON of all inventory items and quantity
  postOptions.parameters = buildPostParams(['inventorylevels', 'topmodule', '', 0, -1, 0]);
  let body;
  httpntlm.post(
    postOptions
    , (err, res) => {
      if (err) throw err;
      if (cb) {
        body = res.body.replace(/&#(\d+);/g, (match, p1) => String.fromCharCode(p1));
        body = body.replace(/\\(['"])/g, '$1');
        jsdom.env(body, (err2, window) => {
          if (err2) throw err2;
          const tr = window.document.getElementsByTagName('tr');
          let qtyRow;
          let skuRow;
          const headers = tr[0].cells;
          const parts = {};
          let i;
          for (i = 0; i < headers.length; i += 1) {
            // Since the vhost incorrectly labels the columns
            if (headers[i].innerHTML === 'Attribs') {
              qtyRow = i;
            } else if (headers[i].innerHTML === 'Quantity') {
              skuRow = i;
            }
          }
          for (i = 1; i < tr.length; i += 1) {
            parts[tr[i].cells[skuRow].innerHTML] = parseInt(tr[i].cells[qtyRow].innerHTML, 10);
          }
          if (cb) cb(parts);
        });
      }
    });
};


exports.setUsernamePassword = function setUsernamePassword(user, pass) {
  postOptions.username = user;
  postOptions.password = pass;
};

exports.getManjobParts = function getManjobParts(manjobNumber, category, cb) {
  getManjobHTML(manjobNumber, category, (window) => {
    const parts = {};
    const res = {};
    const tds = window.document.getElementsByTagName('td');
    for (let idx = 0; idx < tds.length; idx += 1) {
      if (tds[idx].innerHTML === 'SKU:') {
        res.mainSku = tds[idx + 1].innerHTML;
      }
      if (tds[idx].innerHTML === 'Description:') {
        res.storage = /(\d+)GB/.exec(tds[idx + 1].innerHTML)[1];
      }
    }
    let buildItems = window.document.getElementById('builditemsmodule');
    buildItems = buildItems.getElementsByTagName('td');

    for (let x = 4; x < buildItems.length; x += 4) {
      const qty = buildItems[x].children[0].value;
      const pattern = new RegExp(`${manjobNumber},\\s+\\'([^\\']+)`);
      const sku = pattern.exec(buildItems[x].innerHTML)[1];
      parts[sku] = qty;
    }
    res.parts = parts;
    if (cb) cb(res);
  });
};

exports.getManjobNumbers = function getManjobNumbers(location, cb) {
  let postArgument;
  switch (location.toLowerCase()) {
    case 'open':
      postArgument = 'getopenmanufacturing';
      break;
    case 'pulled':
    case 'inprocess':
      postArgument = 'getinprocessmanufacturing';
      break;
    case 'started':
      postArgument = 'getstartedmanufacturing';
      break;
    case 'completed':
      postArgument = 'getcompletedmanufacturing';
      break;
    case 'canceled':
      postArgument = 'getcanceledmanufacturing';
      break;
    default:
      postArgument = null;
  }
  if (postArgument !== null) {
    postOptions.parameters = buildPostParams([postArgument, 'topmodule']);
    httpntlm.post(postOptions, (err, res) => {
      if (err) throw err;
      const fixedHTML = fixHTML(res.body);
      console.log(fixedHTML);
    });
  } else cb('Unrecognized manjob location specified.');
};