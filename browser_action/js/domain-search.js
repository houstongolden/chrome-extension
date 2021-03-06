var DomainSearch = {
  launch: function() {
    $("#currentDomain").text(window.domain);
    $("#completeSearch").attr("href", "https://emailhunter.co/search/" + window.domain + "?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup");

    // Alternative search
    this.withoutSudomainLink();

    this.launchSearch();
    this.feedbackNotification();

    // Get account information
    this.addAccountInformation();

    // Analytics
    Analytics.trackEvent("Open browser popup");
  },

  // Suggest to search without subdomain
  //
  withoutSudomainLink: function() {
    this_popup = this;

    if (withoutSubDomain(window.domain)) {
      $("#currentDomain").append("<span class='new-domain-link' title='Search just \"" + newdomain + "\"'>" + newdomain + "</a>");
      $(".new-domain-link").click(function() {
        this_popup.newSearch(newdomain);
      });
    }
  },

  // Start a new search with a new domain
  //
  newSearch: function(domain) {
    window.domain = domain;

    $("#currentDomain").text(window.domain);
    $("#completeSearch").attr("href", "https://emailhunter.co/search/" + window.domain + "?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup");
    $(".domain-loader").show();
    $("#resultsNumber").text("");

    $(".result").remove();
    $(".see_more").remove();

    this.launchSearch();
  },

  // Launch domain search
  //
  launchSearch: function() {
    this_popup = this;

    chrome.storage.sync.get('api_key', function(value){
      if (typeof value["api_key"] !== "undefined" && value["api_key"] !== "") {
        this_popup.loadResults(value["api_key"]);
      }
      else {
        this_popup.loadResults();
      }
    });
  },

  // Load the email addresses search of the current domain
  //
  loadResults: function(api_key) {
    this_popup = this;

    if (typeof api_key == "undefined") {
      url = 'https://api.emailhunter.co/trial/v2/domain-search?domain=' + window.domain;
    }
    else {
      url = 'https://api.emailhunter.co/v2/domain-search?domain=' + window.domain + '&api_key=' + api_key;
    }

    $.ajax({
      url : url,
      headers: {"Email-Hunter-Origin": "chrome_extension"},
      type : 'GET',
      dataType : 'json',
      success : function(json){
        $(".results").slideDown(300);
        this_popup.resultsMessage(json.meta.results);
        $(".domain-loader").hide();

        // We count call to measure use
        countCall();

        // Update the number of requests
        this_popup.addAccountInformation();

        // We display the email pattern
        if (json.data.pattern != null) {
          $("#domain-pattern").html("Most common pattern: <strong>" + this_popup.addPatternTitle(json.data.pattern) + "@" + domain + "</strong></span>");
        }

        // Each email
        $.each(json.data.emails.slice(0,10), function(email_key, email_val) {

          if (email_val.confidence < 30) { confidence_score_class = "low-score"; }
          else if (email_val.confidence > 70) { confidence_score_class = "high-score"; }
          else { confidence_score_class = "average-score"; }

          email_value = email_val.value.replace("**", "<span data-toggle='tooltip' data-placement='right' title='Please log in to see the entire email addresses.'>aa</span>")

          if (typeof api_key == "undefined") { verify_check = "" }
          else { verify_check = '<span class="verify_email" data-toggle="tooltip" data-placement="top" title="" data-original-title="Verify"><i class="fa fa-check"></i></span><span class="verification_result"></span>' }

          $(".results").append('\n\
            <div class="result">\n\
              <p class="sources-link light-grey">' + this_popup.sourcesText(email_val.sources.length) + '\n\
                <i class="fa fa-caret-down"></i>\n\
              </p>\n\
              <div class="email-address">\n\
                <div class="email">' + email_value + '</div>\n\
                <div class="score ' + confidence_score_class + '" data-toggle="tooltip" data-placement="top" data-original-title="Confidence score: ' + email_val.confidence + '%"></div>\n\
                ' + verify_check + '\n\
              </div>\n\
              <div class="sources-list"></div>\n\
            </div>\n\
          ');
          $('[data-toggle="tooltip"]').tooltip();

          // Each source
          $.each(email_val.sources, function(source_key, source_val) {

            if (source_val.uri.length > 60) { show_link = source_val.uri.substring(0, 50) + "..."; }
            else { show_link = source_val.uri; }

            $(".sources-list").last().append('<div class="source"><a href="' + source_val.uri + '" target="_blank">' + show_link + '</a></div>');
          });
        });

        if (json.meta.results > 10) {
          remaining_results = json.meta.results - 10;
          $(".results").append('<a class="see_more" target="_blank" href="https://emailhunter.co/search/' + window.domain + '?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup">See all the email addresses (' + numberWithCommas(remaining_results) + ' more)</a>');
        }

        // Complete Search button
        if (json.meta.results > 0) {
          $("#completeSearch").fadeIn();
        }

        // Verify an email address
        this_popup.verifyEmailAddress();

        // Deploy sources
        $(".sources-link").click(function () {
          if ($(this).parent().find(".sources-list").is(":visible")) {
            $(this).parent().find(".sources-list").slideUp(300);
            $(this).find(".fa-caret-up").removeClass("fa-caret-up").addClass("fa-caret-down")
          }
          else {
            $(this).parent().find(".sources-list").slideDown(300);
            $(this).find(".fa-caret-down").removeClass("fa-caret-down").addClass("fa-caret-up")
          }
        });
      },
      error: function(xhr) {
        if (xhr.status == 400) {
          $(".error-message").text("Sorry, something went wrong on the query.");
          $(".error").slideDown(300);
          $(".domain-loader").hide();
        }
        else if (xhr.status == 401) {
          $(".connect-again-container").slideDown(300);
          $(".domain-loader").hide();
        }
        else if (xhr.status == 429) {
          if (typeof api_key == "undefined") {
            $(".connect-container").slideDown(300);
            $(".domain-loader").hide();
          }
          else {
            $(".upgrade-container").slideDown(300);
            $(".domain-loader").hide();
          }
        }
        else {
          $(".error-message").text("Something went wrong, please try again later.");
          $(".error").slideDown(300);
          $(".domain-loader").hide();
        }
      }
    });
  },

  // Show the success message with the number of email addresses
  //
  resultsMessage: function(results_number) {
    if (results_number == 0) {      $("#results-number").text('No email address found.'); }
    else if (results_number == 1) { $("#results-number").text('One email address found.'); }
    else {                          $("#results-number").text(numberWithCommas(results_number) + ' email addresses found.'); }
  },

  // Show the number of sources
  //
  sourcesText: function(sources) {
    if (sources == 1) {       sources = "1 source"; }
    else if (sources < 20) {  sources = sources + " sources"; }
    else {                    sources = "20+ sources"; }
    return sources;
  },

  // Add the tooltips to the pattern
  //
  addPatternTitle: function(pattern) {
    pattern = pattern.replace("{first}", "<span data-toggle='tooltip' data-placement='top' title='First name'>{first}</span>")
                     .replace("{last}", "<span data-toggle='tooltip' data-placement='top' title='Last name'>{last}</span>")
                     .replace("{f}", "<span data-toggle='tooltip' data-placement='top' title='First name initial'>{f}</span>")
                     .replace("{l}", "<span data-toggle='tooltip' data-placement='top' title='Last name initial'>{l}</span>");

    return pattern;
  },

  // Show a notification to ask for feedback if user has made at leat 10 calls
  //
  feedbackNotification: function() {
    chrome.storage.sync.get('calls_count', function(value){
      if (value['calls_count'] >= 10) {
        chrome.storage.sync.get('has_given_feedback', function(value){
          if (typeof value['has_given_feedback'] == "undefined") {
            $('.feedback-notification').slideDown(300);
          }
        });
      }
    });

    // Ask to note the extension
    $("#open-rate-notification").click(function() {
      $('.feedback-notification').slideUp(300);
      $(".rate-notification").slideDown(300);
    });

    // Ask to give use feedback
    $("#open-contact-notification").click(function() {
      $('.feedback-notification').slideUp(300);
      $(".contact-notification").slideDown(300);
    });

    $(".feedback_link").click(function() {
      chrome.storage.sync.set({'has_given_feedback': true});
    });
  },

  // Get account information
  //
  addAccountInformation: function() {
    Account.get(function(json) {
      if (json == "none") {
        $(".account-information").html("\n\
          Not logged in \n\
          <div class='pull-right'>\n\
            <a target='_blank' href='https://emailhunter.co/chrome/welcome?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup'>Sign in</a>\n\
            or <a target='_blank' href='https://emailhunter.co/users/sign_up?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup'>Create a free account</a>\n\
          </div>\n\
        ");
      }
      else {
        $(".account-information").html(""+json.data.email+"<div class='pull-right'>"+numberWithCommas(json.data.calls.used)+" / "+numberWithCommas(json.data.calls.available)+" requests this month • <a target='_blank' href='https://emailhunter.co/subscriptions?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup'>Upgrade</a></div>");
      }
    })
  },

  // Verify an email address
  //
  verifyEmailAddress: function() {
    this_popup = this;

    $(".verify_email").click(function() {
      verification_link_tag = $(this);
      verification_link_tag.hide();
      verification_link_tag = $(this)
      verification_link_tag.hide()
      verification_result_tag = $(this).parent().find(".verification_result");
      verification_result_tag.html("<span class='light-grey'><i class='fa fa-spinner fa-spin'></i> Verifying...</span>");

      email = verification_result_tag.parent().find(".email").text();

      chrome.storage.sync.get('api_key', function(value){
        api_key = value["api_key"];

        if (typeof api_key == "undefined") {
          url = 'https://api.emailhunter.co/trial/v2/email-verifier?email=' + email;
        }
        else {
          url = 'https://api.emailhunter.co/v2/email-verifier?email=' + email + '&api_key=' + api_key;
        }

        $.ajax({
          url : url,
          headers: {"Email-Hunter-Origin": "chrome_extension"},
          type : 'GET',
          dataType : 'json',
          success : function(json){

            // Update the number of requests
            this_popup.addAccountInformation();

            if (json.data.result == "deliverable") {
              verification_result_tag.html("<span class='green'><i class='fa fa-check'></i><a href='https://emailhunter.co/verify/" + email + "?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup' target='_blank' title='Click to see the complete check result'>Deliverable</a></span>");
            }
            else if (json.data.result == "risky") {
              verification_result_tag.html("<span class='dark-orange'><i class='fa fa-exclamation-triangle'></i><a href='https://emailhunter.co/verify/" + email + "?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup' target='_blank' title='Click to see the complete check result'>Risky</a></span>");
              }
            else
              verification_result_tag.html("<span class='red'><i class='fa fa-times'></i><a href='https://emailhunter.co/verify/" + email + "?utm_source=chrome_extension&utm_medium=extension&utm_campaign=extension&utm_content=browser_popup' target='_blank' title='Click to see the complete check result'>Undeliverable</a></span>");
          },
          error: function(xhr) {
            if (xhr.status == 429) {
              if (typeof api_key == "undefined") {
                verification_result_tag.html("<span class='light-grey'>Please sign in</span>");
              }
              else {
                verification_result_tag.html("<span class='light-grey'>Please upgrade</span>");
              }
            }
            else {
              verification_result_tag.html("<span class='light-grey'>Error</span>");
            }
          }
        });
      });
    })
  }
}
