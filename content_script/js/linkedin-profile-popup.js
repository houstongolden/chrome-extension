// Launch popup
//
function launchPopup() {
  appendOverlay(function() {
    openPopup(function() {
      launchSearch();
      addAccountInformation();

      // Analytics
      eventTrack("Open LinkedIn popup");
    });
  });

  // Drag popup
  $("#eh_popup").draggable({ handle: ".eh_popup_drag" });

  // Close popup
  $("#eh_overlay, .eh_popup_close").click(function() {
    closePopup();
  });
  $(document).keyup(function(e) {
    if (e.keyCode == 27) {
      closePopup();
    }
  });
}


// Destroy popup and overlay
//
function closePopup() {
  $("#eh_popup").remove();
  $("#eh_overlay").remove();
}


// Append overlay on the page
//
function appendOverlay(callback) {
  var docHeight = $(document).height();

  $("body").append('<div id="eh_overlay"></div>');

  $("#eh_overlay")
    .height(docHeight)
    .css({
      'opacity' : 0.4,
      'position': 'absolute',
      'top': 0,
      'left': 0,
      'background-color': 'black',
      'width': '100%',
      'z-index': 11000
  });

  callback();
}


// Show account information
//
function addAccountInformation() {
  getAccountInformation(function(json) {
    if (json == "none") {
      $("#eh_popup_account").html('Not logged in. <a target="_blank" href="https://emailhunter.co/users/sign_in?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=linkedin_popup">Sign in</a> or <a target="_blank" href="https://emailhunter.co/users/sign_up?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup">Create a free account</a>');
    }
    else {
      $("#eh_popup_account").html(json.email+' • <a target="_blank" href="https://emailhunter.co/leads?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=linkedin_popup">My leads</a><div class="pull-right">'+numberWithCommas(json.calls.used)+" / "+numberWithCommas(json.calls.available)+' requests</div>');
    }
  })
}


// Open popup
//
function openPopup(callback) {
  var windowHeight = $(window).height();
  var windowWidth = $(window).width();

  $("body").append('<div id="eh_popup"><a href="https://emailhunter.co/chrome?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=linkedin_popup#faq" target="_blank"><i class="fa fa-question-circle eh_popup_question"></i></a><i class="fa fa-ellipsis-v eh_popup_drag"></i><div class="eh_popup_close">&times;</div><div class="eh_popup_name">' + window.profile["first_name"] + ' ' + window.profile["last_name"] + '</div><div id="eh_popup_error"></div><form id="eh_popup_ask_domain"><div id="eh_popup_ask_domain_message"></div><input placeholder="company.com" id="eh_popup_ask_domain_field" type="text" name="domain"><button class="orange-btn" type="submit">Find</button></form><div id="eh_popup_content_container"><div id="eh_popup_content"></div><div id="eh_email_action_message"></div></div><div class="eh_popup_confidence_score"></div><div id="eh_popup_results_link_container"></div><div id="eh_popup_results_show"><div class="eh_popup_found_email_addresses"></div><div class="eh_popup_parsed_email_addresses"></div></div><div id="eh_popup_account">Loading...</div></div>');

  $("#eh_popup")
    .css({
      'position': 'fixed',
      'top': windowHeight / 2 - 200,
      'left': windowWidth / 2 - 300,
      'width': '560px',
      'z-index': 11001
  });

  callback();
}


// Launch email search
//
function launchSearch() {
  if (window.profile["last_company"].length) {

    // Looking for domain name
    mainMessagePopup('Looking for ' + window.profile["first_name"] + '\'s email address...', true);
    getWebsite(window.profile, function(website) {
      if (website != "none") {
        window.profile["domain"] = cleanDomain(website);

        $('#eh_popup_results_link_container').html('<div class="eh_popup_results_message">Looking for ' + window.profile["domain"] + ' email addresses...</div>');

        // Use or not API key
        chrome.storage.sync.get('api_key', function(value){
          if (typeof value["api_key"] !== "undefined" && value["api_key"] !== "") {
            api_key = value["api_key"];
          }
          else { api_key = ''; }

          // Generate the email
          generate_email_endpoint = 'https://api.emailhunter.co/v1/generate?domain=' + window.profile["domain"] + '&first_name=' + window.profile["first_name"] + '&last_name=' + window.profile["last_name"] + '&position=' + window.profile["position"] + '&company=' + window.profile["last_company"];
          apiCall(api_key, generate_email_endpoint, function(email_json) {

            // We count call to measure use
            countCall();

            // Count how much email addresses there is on the domain
            count_endpoint = 'https://api.emailhunter.co/v1/email-count?domain=' + window.profile["domain"];
            apiCall(api_key, count_endpoint, function(count_json) {

              // If email addresses has NOT been found
              if (email_json.email == null) {

                // Maybe try to remove a subdomain if there is one
                if (withoutSubDomain(window.profile["domain"])) {
                  window.profile["domain"] = withoutSubDomain(window.profile["domain"]);
                  launchSearch();
                }
                else {
                  mainMessagePopup("No result.");
                  showResultsCountMessage(count_json.count);
                  $("#eh_popup_results_show").slideDown(300);

                  // If we have at least one email on the domain, we show it to help
                  if (count_json.count > 0) {
                    showEmailList();
                  }

                  // Maybe there are email addresses directly on the profile! Let's show them :)
                  showParsedEmailAddresses();
                }
              }

              // If email has been found
              else {
                showFoundEmailAddress(email_json, count_json);
                showParsedEmailAddresses();
                addAccountInformation();
                $("#eh_popup_results_show").slideDown(300);
              }

            askNewDomainListener();
            });
          });
        });
      }
      else {
        askDomainName();
      }
    });
  }
  else {
    if (typeof window.profile["profile_main_content"] == "undefined") {
      showError("You don't have access to this profile.");
      $(".eh_popup_name").text("No access");
    } else {
      showError(window.profile["first_name"] + ' has no current professional experience.');
    }
  }
}


// Show the main email address found
//
function showFoundEmailAddress(email_json, count_json) {
  mainMessagePopup(email_json.email);
  addCopyButton(email_json.email);
  showConfidence(email_json.score);
  addSaveButton(email_json.email);

  window.profile["email"] = email_json.email;
  window.profile["confidence_score"] = email_json.score;

  if (count_json.count > 1) { es = 'es' }
  else { es = '' }
  $('#eh_popup_results_link_container').html('<a class="eh_popup_results_link" href="https://emailhunter.co/search/' + window.profile["domain"] + '?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=linkedin_popup" target="_blank">' + count_json.count + ' email address' + es + ' for ' + window.profile["domain"] + '<i class="fa fa-external-link"></i></a> <span class="eh_popup_separator">•</span> <span class="eh_popup_ask_domain">Try with an other domain name</span>');

  $('#eh_popup_results_link_container').slideDown(300);
}

// Add a copy button to copy the email address
//
function addCopyButton(email) {
  $("<div id='eh_copy_email_button' class='fa fa-files-o' data-toggle='tooltip' data-placement='top' title='Copy'></div>").insertBefore( "#eh_email_action_message" );
  $('#eh_copy_email_button').tooltip();

  $("#eh_copy_email_button").click(function() {
    executeCopy(email);
    displayActionMessage("Copied!");
    console.log("\""+email+"\" copied in the clipboard!");
  })
}


// Add a copy button to copy the email address
//
function addSaveButton() {
  $("<div id='eh_save_email_button' class='fa fa-floppy-o' data-toggle='tooltip' data-placement='top' title='Save the lead'></div>").insertBefore( "#eh_email_action_message" );
  $('#eh_save_email_button').tooltip();

  $("#eh_save_email_button").click(function() {
    $('#eh_save_email_button').tooltip("hide");
    $(this).remove();
    $("<div class='fa fa-spinner fa-spin eh_save_lead_loader'></div>").insertBefore("#eh_email_action_message");

    saveLead(window.profile, function(response) {
      if (typeof response.status != "undefined" && response.status == "success") {
        displayActionMessage("Saved!");
        console.log("Saved in leads!");
      }
      else if (response == "please_sign_in") {
        displayActionMessage("Please sign in!");
      }
      else {
        displayActionMessage("Error. Please try again later.");
      }
      $(".eh_save_lead_loader").removeClass("fa-spinner fa-spin").addClass("fa-floppy-o");
    });
  })
}


// Message displayed near actions
//
function displayActionMessage(message) {
  $("#eh_email_action_message").text(message);

  setTimeout(function(){
    $("#eh_email_action_message").text("");
  }, 3000);
}


// Show the number of email addresses found on a domain name
//
function showResultsCountMessage(results_number) {
  if (results_number == 0) {
    $(".eh_popup_found_email_addresses").append('<p>Nothing found with the domain <strong>' + window.profile["domain"] + '</strong>. Maybe <span class="eh_popup_ask_domain">try another domain name</span>?</p>');
  } else if (results_number == 1) {
    $(".eh_popup_found_email_addresses").append('<p>One email address using the domain <strong>' + window.profile["domain"] + '</strong> found:</p>');
  } else {
    $(".eh_popup_found_email_addresses").append('<p>' + results_number + ' email addresses using the domain <strong>' + window.profile["domain"] + '</strong> found:</p>');
  }
}


// Search for email addresses on a string (in this case, the page body)
//
function parseProfileEmailAddresses(string) {
  return string.match(/([a-zA-Z][\w+\-.]+@[a-zA-Z\d\-]+(\.[a-zA-Z]+)*\.[a-zA-Z]+)/gi);
}


// Display the list of email addresses directly found on the profile
//
function showParsedEmailAddresses() {
  if (typeof window.profile["profile_main_content"] != "undefined") {
    email_addresses = parseProfileEmailAddresses(window.profile["profile_main_content"]);
    if (email_addresses != null && email_addresses.length > 0) {
      var unique_email_addresses = [];
      $.each(email_addresses, function(i, el){
        if($.inArray(el, unique_email_addresses) === -1) unique_email_addresses.push(el);
      });

      $(".eh_popup_parsed_email_addresses").append("<hr>");
      if (unique_email_addresses.length == 1) {
        $(".eh_popup_parsed_email_addresses").append('<p>One email address found on the profile of ' + window.profile["first_name"] + ':</p>');
      }
      else {
        $(".eh_popup_parsed_email_addresses").append('<p>' + unique_email_addresses.length + ' email addresses found on this profile:</p>');
      }

      $.each(unique_email_addresses.slice(0,5), function(email_key, email_val) {
        $(".eh_popup_parsed_email_addresses").append('<div class="eh_popup_email_list">' + email_val + '<i class="fa fa-floppy-o eh_save_other_email" data-toggle="tooltip" data-placement="top" data-email="' + email_val + '" title="Save the lead with this email address"></i></div>');
      });

      saveOtherEmailAddress();
    }
  }
}

// Save the lead with an other email address
//
function saveOtherEmailAddress() {
  $(".eh_save_other_email").tooltip();

  $(".eh_save_other_email").click(function() {
    container = $(this).parent();
    container.append("<i class='eh_save_other_email_icon fa fa-spinner fa-spin'></i>");

    $(this).tooltip("hide");
    $(this).remove();

    window.profile["email"] = $(this).attr("data-email");

    saveLead(window.profile, function(response) {
      container.find(".fa-spinner").remove();
      container.append("<i class='eh_save_other_email_icon fa fa-floppy-o'></i>");

      if (typeof response.status != "undefined" && response.status == "success") {
        container.append("<span class='eh_save_other_email_status'>Saved!</span>");
        console.log("Saved in leads!");
      }
      else if (response == "please_sign_in") {
        container.append("<span class='eh_save_other_email_status'>Please sign in!</span>");
      }
      else {
        container.append("<span class='eh_save_other_email_status'>Error. Please try again later.</span>");
      }

      $(".eh_save_other_email_status").delay(3000).queue(function() {
        $(this).remove();
      })
    });
  })
}

// Show a list of email addresses found on the domain name
//
function showEmailList() {
  domain_search_endpoint = 'https://api.emailhunter.co/v1/search?domain=' + window.profile["domain"];
  apiCall(api_key, domain_search_endpoint, function(domain_json) {
    $.each(domain_json.emails.slice(0,5), function(email_key, email_val) {
      $(".eh_popup_found_email_addresses").append('<div class="eh_popup_email_list">' + email_val.value + '<i class="fa fa-floppy-o eh_save_other_email" data-toggle="tooltip" data-placement="top" data-email="' + email_val.value + '" title="Save the lead with this email address"></i></div>');
    });
    saveOtherEmailAddress();

    $(".eh_popup_found_email_addresses").append('<div class="eh_popup_email_list"><a class="eh_popup_results_link" href="https://emailhunter.co/search/' + window.profile["domain"] + '?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=linkedin_popup" target="_blank">See results for ' + window.profile["domain"] + '<i class="fa fa-external-link"></i></a> <span class="eh_popup_separator">•</span> <span class="eh_popup_ask_domain">Try with another domain name</span></div>');
    askNewDomainListener();
  });

  $("#eh_popup_results_show").slideDown(300);
}


// Ask a new domain on click
//
function askNewDomainListener() {
  $(".eh_popup_ask_domain").click(function () {
    $("#eh_popup_results_link_container").hide();
    $("#eh_popup_results_show").hide();
    $(".eh_popup_found_email_addresses").html("");
    askDomainName();
  });
}


// Show the main message in popup on LinkedIn
//
function mainMessagePopup(message, loader) {
  console.log(message);
  loader = loader || false;
  if (loader == true) {
    loader_html = '<i class="fa fa-spinner fa-spin loader"></i>';
  }
  else { loader_html = ''; }

  $("#eh_popup_content").html(loader_html + message);
}


// Show confidence score
//
function showConfidence(score) {
  $(".eh_popup_confidence_score").html('<div class="eh_popup_confidence">' + score + '% confidence</div><div class="eh_popup_confidence_bar"><div class="eh_popup_confidence_level" style="width: ' + score + '%;"></div></div>');
  $(".eh_popup_confidence_score").show();
}


// Ask for the domain name
// Appends in three cases :
// - no domain name has been found
// - a domain has been found but gives no result
// - it gave result but the user still want to try with another domain name
//
function askDomainName(showMessage) {
  $(".eh_popup_confidence_score").slideUp(300);

  $("#eh_popup_content_container").slideUp(300, function() {
    $("#eh_popup_ask_domain").slideDown(300, function() {
      $("#eh_popup_ask_domain_field").focus();
    });

    if (typeof window.profile["email"] != "undefined") {
      $("#eh_popup_ask_domain_message").html('You already found <strong>' + window.profile["email"] + '</strong>. Would you like to find the email address using another domain name?');
    }
    else if (typeof window.profile["domain"] != "undefined") {
      $("#eh_popup_ask_domain_message").text('No email found with <strong>' + window.profile["domain"] + '</strong>. Maybe try another domain name?');
    }
    else {
      $("#eh_popup_ask_domain_message").html('We couldn\'t find <strong>' + window.profile["last_company"] + '</strong> website. Please enter the domain name to launch the search. <a href="https://google.com/search?q= ' + window.profile["last_company"] + '" target="_blank">Search the website on Google &#187;</a>');
    }

    $("#eh_popup_ask_domain").submit(function() {
      $("#eh_popup_ask_domain button").prop("disabled", true);
      $("#eh_popup_ask_domain").delay(500).slideUp(300, function() {
        $("#eh_popup_ask_domain button").prop("disabled", false);
        $("#eh_popup_content_container").slideDown(300);

        $(".eh_popup_parsed_email_addresses").html("");
        $("#eh_save_email_button, #eh_copy_email_button").remove();

        window.profile["domain"] = $("#eh_popup_ask_domain_field").val();
        launchSearch();
      });

      return false;
    });
  });
}


// Throw an error
//
function showError(error) {
  if (linkedinPageType() == "profile") {
    $("#eh_popup_content_container").slideUp(300);
    $("#eh_popup_error").html(error).slideDown(300);
  }
  else if (linkedinPageType() == "search") {
    $("#eh_search_popup_content_container").slideUp(300);
    $("#eh_search_popup_error").html(error).slideDown(300);
    console.log("ok");
  }
}


// Finds the domain name of the last experience or returns "none"
//
// 1. We try to find it directly on the LinkeDIn company page
// 2. We try to find it using Clearbit API
//
function getWebsite(profile, callback) {
  getWebsiteFromProfile(profile, function(website) {
    if (website == "none") {
      $.ajax({
        url : "https://autocomplete.clearbit.com/v1/companies/suggest?query=" +  encodeURIComponent(profile["last_company"]).substring(0, 17),
        type : 'GET',
        success : function(response){
          if (typeof response[0] !== "undefined") {
            callback(response[0].domain);
          }
          else {
            callback("none");
          }
        },
        error : function() {
          callback("none");
        }
      });
    }
    else {
      callback(website);
    }
  });
}


function getWebsiteFromProfile(profile, callback) {
  if (typeof profile["domain"] == "undefined") {
    if (typeof profile["last_company"] != "undefined" && typeof profile["last_company_path"] != "undefined") {
      if (profile["last_company_path"].indexOf("linkedin.com") > -1) {
        linkedin_company_page = profile["last_company_path"];
      } else {
        linkedin_company_page = "https://www.linkedin.com" + profile["last_company_path"];
      }
      $.ajax({
        url : linkedin_company_page,
        type : 'GET',
        success : function(response){
          website = websiteFromCompanyPage(response);
          if (typeof website == "undefined" || website == "http://" || website == "http://N/A" || website == false) {
            callback("none");
          }
          else {
            callback(website);
          }
        },
        error : function() {
          callback("none");
        }
      });
    }
    else {
      callback("none");
    }
  }
  else {
    callback(profile["domain"]);
  }
}


// Copy in email in LinkedIn popup
//
function executeCopy(text) {
    var input = document.createElement('textarea');
    $("#eh_popup").prepend(input);
    input.value = text;
    input.focus();
    input.select();
    document.execCommand('Copy');
    input.remove();
}
