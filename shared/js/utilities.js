// Find if a subdomain can be removed and do it
//
function withoutSubDomain(domain) {
  var subdomainsCount = (domain.match(/\./g) || []).length;
  if (subdomainsCount > 1) {
    newdomain = domain;
    newdomain = newdomain.substring(newdomain.indexOf(".") + 1);

    if (newdomain.length > 6) {
     return newdomain;
    }
    else {
      return false;
    }
  }
  return false;
}


// Add commas separating thousands
//
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Clean domain functions
//
function cleanDomain(website){
  domain = website.toLowerCase();
  domain = domain.allReplace({'https://': '', 'http://': '', 'www.': ''});
  domain = cleanUrlEnd(domain);

  return domain;
}

function cleanUrlEnd(str) {
  if (str.indexOf('/') != -1) {
    str = str.substring(0, str.indexOf('/'));
  }
  if (str.indexOf('?') != -1) {
    str = str.substring(0, str.indexOf('?'));
  }

  return str;
}

// Search and replace several elements in a string
//
String.prototype.allReplace = function(obj) {
  var retStr = this
  for (var x in obj) {
    retStr = retStr.replace(new RegExp(x, 'g'), obj[x])
  }
  return retStr
}
