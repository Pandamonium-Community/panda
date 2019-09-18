// Only do anything if jQuery isn't defined
if (typeof jQuery === 'undefined') {

	if (typeof $ === 'function') {
		// warning, global var
		var thisPageUsingOtherJSLibrary = true;
	}
	
	function getScript(url, success) {
	
		var script     = document.createElement('script');
		     script.src = url;
		
		var head = document.getElementsByTagName('head')[0],
		done = false;
		
		// Attach handlers for all browsers
		script.onload = script.onreadystatechange = function() {
		
			if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
			
			done = true;
				
				// callback function provided as param
				success();
				
				script.onload = script.onreadystatechange = null;
				head.removeChild(script);
				
			}
		
		};
		
		head.appendChild(script);
	}
	
	getScript('https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js', function() {
	
		if (typeof jQuery === 'undefined') {
		    document.write('<scr' + 'ipt type=�text/javascript� src=�https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js�></scr' + 'ipt>');
		    jQuery(document).ready(function () {
		        setTimeout(
                    function () {
                        initTooltips();
                    }, 5000);
		        
		    });
		} else {
		    jQuery(document).ready(function () {
		        setTimeout(
                    function () {
                        initTooltips();
                    }, 5000);
		    });
		
		}
		jQuery.noConflict();
	});
	
	
} else { // jQuery was already loaded
	
	initTooltips();
}

var tipsToRestyle = { ids: [], names: [] };
//var returnedTipData = {};

function initTooltips() { //Load our script now that jquery is confirmed as loaded
    var r = jQuery.Deferred();
    var torc_data = {};
    if (window['torc_tooltips'] !== undefined)
        torc_data = window['torc_tooltips'];
    jQuery('.dsq-widget-meta').each(function (i, e) {
        var l = 0;
        jQuery(e).children('a').each(function (x, y) {
            if (l == 1) jQuery(y).attr('data-torc', 'notip');
            l++;
        });
    });
    torc_data = jQuery.extend({}, { "override": false, "prettylinks": true, "iconlinks": true, "notextlargeicon": false, "language": "" }, torc_data);
    jQuery.getScript("https://torcommunity.com/db/jQuery.torctip.js", function (data, textStatus, jqxhr) {
        if (!jQuery("link[href='https://torcommunity.com/db/tooltips.css']").length) jQuery("<link href='https://torcommunity.com/db/tooltips.css' type='text/css' rel='stylesheet' />").appendTo("head");
        if (!jQuery("body").children("#torctip").length) jQuery("body").append("<div id='torctip' />");
        if (!jQuery("body").children("#torctipcon").length) jQuery("body").append("<div id='torctipcon' />");
        //try {
        var searchurls = [
            "/database/item/",
            "/database/schematic/",
            "/database/ability/",
            "/database/mission/",
            "/database/talent/",
            "/database/achievement/",
            "/database/npc/",
            "/database/codex/",
            "/database/achievement/",
            "/database/companion/",
            "/database/collection/",
            //"/database/class/",
        ];
        for (var i = 0; i < searchurls.length; i++) {
            jQuery.each(jQuery("a[href*='" + searchurls[i] + "']"), function (key, value) {
                var fullurl = jQuery(value).prop("href");
                var fullIndex = fullurl.indexOf("torcommunity.com");
                if (fullIndex !== -1) {
                    var offset = value.href.indexOf(searchurls[i]) + searchurls[i].length;
                    var tempLangStor = torc_data["language"];
                    var langtag = fullurl.substring(fullIndex + 17, fullIndex + 19);
                    if (langtag == "fr" || langtag == "de") {
                        torc_data["language"] = langtag + "-" + langtag;
                    }
                    var linkId = value.href.substring(offset);
                    if (linkId.indexOf('/') != -1) {
                        linkId = linkId.substring(0, 7);
                        torctipCreate(torc_data, linkId, value, true);
                    }
                    else if (linkId.indexOf('_') == -1 && linkId.indexOf('+') == -1 && linkId.indexOf('-') == -1) {
                        torctipCreate(torc_data, linkId, value, true);
                    }
                    else {
                        torctipCreate(torc_data, linkId, value, false);
                    }
                    torc_data["language"] = tempLangStor;
                }
            });
        }
            //console.log(tipsToRestyle);
            if (torc_data["override"]) {
                if (jQuery("a[href*='www.torhead.com/item/']").length != -1) {
                    var elements = jQuery("a[href*='www.torhead.com/item/']");
                    for (var index = 0; index < elements.length; index++) {
                        var value = elements[index];
                        var offset = value.href.indexOf("www.torhead.com/item/") + 21;
                        var linkId = value.href.substring(offset); //28
                        if (linkId.indexOf("/") != -1) { //strip the link id
                            linkId = linkId.substring(linkId.indexOf("/")+1);
                        }
                        torctipCreate(torc_data, linkId, value, false);
                        /*console.log(linkId);
                        var linktype = "th";
                        torctipCreateReplacement(torc_data, linkId, linktype, value);
                        if (index + 1 < length && index % 100 == 0) {
                            setTimeout(process, 5);
                        }*/
                    }
                }
                if (jQuery("a[href*='swtor.askmrrobot.com/gear/']").length != -1) {
                    jQuery.each(jQuery("a[href*='swtor.askmrrobot.com/gear/']"), function (key, value) {
                        var offset = value.href.indexOf("swtor.askmrrobot.com/gear/") + 26;
                        var linkId = value.href.substring(offset); //33
                        if (linkId.indexOf("/") != -1) { //strip the link id
                            linkId = linkId.substring(linkId.indexOf("/") + 1);
                        }
                        linkId = linkId.replace(/\-/g, '+');
                        console.log(linkId);
                        torctipCreate(torc_data, linkId, value, false);
                        /*var linktype = "amr";
                        //console.log(linkId);
                        try{
                            torctipCreateReplacement(torc_data, linkId, linktype, value);
                        }
                        catch (err) {
                            //console.log("amr error");
                            torctipCreateReplacement(torc_data, linkId.substring(linkId.indexOf("+") + 1), linktype, value);
                        }*/
                    });
                }
            }
        /*}
        catch (err) {
            console.log(err);
        }*/
            if (tipsToRestyle.ids.length > 0) {
                //console.log(JSON.stringify({ ids: tipsToRestyle }));
                var lang = "en-us";
                if (torc_data["language"].length !== 0) {
                    lang = torc_data["language"];
                }
                jQuery.ajax({
                    type: "POST",
                    url: "https://torcommunity.com/db/build_tooltip_json.php?lang=" + lang,
                    async: true,
                    data: JSON.stringify(tipsToRestyle),
                    contentType: 'application/json',
                    dataType: "json", // Set the data type so jQuery can parse it for you
                    success: function (data) {
                        //console.log(data);
                        for (var i in data) {
                            /*
                            var i = qIdODpB
                            data[i].t = item //type of tooltip
                            data[i].n = Custom-built Sniper Rifle
                            data[i].q = moddable
                            data[i].i = 3446261239_776243026
                            data[i].l = custom-built sniper rifle  //this is only present if the link 
                            */
                            var showText = !torc_data["notextlargeicon"];
                            var showIcon = torc_data["iconlinks"];
                            var noIcons = ["mission", "npc", "codex"];
                            if (noIcons.indexOf(data[i].t) !== -1) {
                                showIcon = false;
                            }
                            var smallIcon = !torc_data["notextlargeicon"];
                            var prettyText = torc_data["prettylinks"];
                            var language = torc_data["language"] || "";

                            var slop = jQuery("<a/>", {
                                href: "https://torcommunity.com/database/" + data[i].t + "/" + i + "/" + data[i].n.replace(/ /g, "+").toLowerCase() + "/",
                                "data-torc": "norestyle",
                                "data-torc-bId": i,
                                "class": "torctip_" + data[i].q
                            });
                            var values = undefined;
                            if (data[i].l == "")
                                values = jQuery("a[href*='" + i + "']");
                            else {
                                var idstring = data[i].l;//.replace(/ /g, "+");
                                console.log(data[i].l);
                                values = jQuery("a[href*='" + idstring + "']");
                                if (values.length == 0) {
                                    idstring = data[i].l; //.replace(/ /g, "-");
                                    values = jQuery("a[href*='" + idstring + "']");
                                }
                                console.log(values.length);
                                console.log(i);
                            }
                            values = jQuery(values).not("a[data-torc='norestyle']").not("a[data-torc='notip']");

                            if (showIcon) {
                                var classString = "torctip_image torctip_image_" + data[i].q;
                                var subClassString = "";
                                if (smallIcon) {
                                    classString += " small_border";
                                    subClassString += "small_image";
                                }
                                var imgsub = jQuery("<img />", {
                                    src: "https://torcommunity.com/db/icons/" + data[i].i + ".jpg",
                                    "class": subClassString,
                                    alt: data[i].n
                                });
                                
                                var imgele = jQuery("<div />", {
                                    "class": classString,
                                    html: imgsub
                                });
                                if (data[i].t !== "companion") {
                                    slop.append(imgele);
                                }
                            }

                            if (slop !== null && showText) {
                                var namestyle = "";
                                if (prettyText) {
                                    namestyle = "torctip_" + data[i].q;
                                }
                                var nameele = jQuery("<div />", {
                                    style: "display: inline-block;",
                                    "class": namestyle,
                                    /*html: jQuery("<a />", {
                                        href: "https://torcommunity.com/database/" + data[i].t + "/" + i + "/" + data[i].n.replace(/ /g, "+").toLowerCase() + "/",
                                        "class": namestyle,
                                        "data-torc": "norestyle",
                                        "data-torc-bId": i,
                                        text: data[i].n
                                    })*/
                                    text: data[i].n
                                });
                                if (data[i].t == "npc") {
                                    var toughness = "torctip_toughness_" + data[i].i;
                                    var toughele = jQuery("<span />", {
                                        "class": toughness
                                    });
                                    nameele.append(toughele);
                                }
                                slop.append(nameele);

                                
                            }
                            //console.log(values);
                            var restyle = (jQuery(slop).attr("data-torc") != "norestyle");
                            jQuery(slop).torctip({
                                link: "https://torcommunity.com/database/item/" + i + "/" + data[i].n.replace(/ /g, "+").toLowerCase() + "/",
                                linkId: i,
                                element: slop,
                                showText: showText,
                                showIcon: showIcon,
                                smallIcon: smallIcon,
                                prettyText: prettyText,
                                restyle: true,
                                linkType: "torc",
                                language: language
                            });
                            //console.log(slop);
                            if (!jQuery(slop).attr("failed")) {
                                jQuery(values).replaceWith(slop); //so sloppy
                            }
                            else {
                                //console.log("it happened");
                            }
                            jQuery(slop).one("click", false, function (f) {
                                if ("ontouchstart" in document.documentElement) {
                                    f.preventDefault();
                                }
                            });
                        }
                    },
                    error: function (data, xhr, ajaxOptions, thrownError) {
                        console.log(xhr.status + ": " + thrownError);
                        console.log(datresponseText);
                    }
                });
            }
    });
    r.resolve();
    return r;
}

function torctipCreate(torc_data, linkId, value, actualId) {
    if (jQuery(value).attr("data-torc") == "notip") return;
    var restyle = (jQuery(value).attr("data-torc") != "norestyle");
    var testtips = (jQuery(value).attr("data-torc-type") == "test");
    //console.log("test = " + testtips);
    if (restyle) {
        if (tipsToRestyle.ids.indexOf(linkId) == -1 && actualId) {
            tipsToRestyle.ids.push(linkId);
        }
        else if (tipsToRestyle.names.indexOf(linkId) == -1 && !actualId){
            tipsToRestyle.names.push(linkId);
        }
        return;
    }
    var showText = !torc_data["notextlargeicon"];
    var showIcon = torc_data["iconlinks"];
    if (value.href.indexOf("/mission/") > -1) {
        //console.log(value.href);
        showIcon = false;
    }
    var smallIcon = !torc_data["notextlargeicon"];
    var prettyText = torc_data["prettylinks"];
    var language = torc_data["language"] || "";

    jQuery(value).torctip({
        link: value.href,
        linkId: linkId,
        element: jQuery(value),
        showText: showText,
        showIcon: showIcon,
        smallIcon: smallIcon,
        prettyText: prettyText,
        restyle: restyle,
        linkType: "torc",
        language: language,
        testtips: testtips
    });
    jQuery(value).one("click", false, function (f) {
        if ("ontouchstart" in document.documentElement) {
            f.preventDefault();
        }
    });
}

function getTooltipEmbed(linkId) {
    alert("Not Implemented yet");
    return;
    var showText = !torc_data["notextlargeicon"];
    var showIcon = torc_data["iconlinks"];
    var smallIcon = !torc_data["notextlargeicon"];
    var prettyText = torc_data["prettylinks"];
    var language = torc_data["language"] || false;
    var restyle = true;
    var slop = jQuery("<a />", {
        href: "torcommunity.com/database/item/" + linkId
    });
    jQuery(slop).torctip({
        link: jQuery(value).href,
        linkId: linkId,
        element: jQuery(value),
        showText: showText,
        showIcon: showIcon,
        smallIcon: smallIcon,
        prettyText: prettyText,
        restyle: restyle,
        linkType: linktype,
        language: language
    });
    if (!jQuery(slop).attr("failed")) {
        jQuery(value).replaceWith(slop); //so sloppy
    }
    else {
        //console.log("it happened");
        throw (42);
    }
}
