$(document).ready(function() {

    // Determine whether or not this script is being ran from the admin panel or front-end
    if(window.location.href.indexOf("/admin/editmodule/") > -1) {
        var preview=1;
    }else{
        preview=0;
    }


    // Check how many menus are on the page. Check how many of these are fixed. Adjust position and site-body according to this count
    var countMenus = $(".m_hmenu_v2").length;
    var site_body = $("#site-body");
    for (i=0; i<countMenus; i++) {
        var thisMenu = $(".m_hmenu_v2:eq("+i+")");
        var thisOB = thisMenu.find(".outer-nav-border");
        var thisMenuType = thisOB.css("position");
        var thisMenuHeight = thisOB.height();
        var site_body_margin_top = parseInt(site_body.css("margin-top"));

        // check if the prev menu was fixed
        if (i>0) {
            var prevMenu = $(".m_hmenu_v2:eq("+(i-1)+")");
            var prevMenuOB = prevMenu.find(".outer-nav-border");
            var prevMenuType = prevMenuOB.css("position");
        }

        // add margin top to the body of the website
        if (thisMenuType=='fixed') {
            site_body.css("margin-top",(site_body_margin_top+thisMenuHeight)+"px");
        }

        if (i>0 && thisMenuType=="fixed" && prevMenuType=="fixed") {
            // calculate
            var prevMenuHeight = prevMenuOB.height();
            var prevMenuTop = parseInt(prevMenuOB.css("top"));

            // apply
            thisOB.css("top",(prevMenuTop+prevMenuHeight)+"px");
            thisOB.last().css("z-index",(1001+i));
        }
    }


    // Menu static
    if (preview==0) {
        $(".m_hmenu_v2").each(function() {
            var menu = $(this);
            var ob = menu.find(".outer-nav-border");
            var id = getThemeId(menu);
            ob.css("content","'"+menu_position[id]+"'");
            if (menu_position[id]=='static') {
                ob.css({"position":"absolute"});
                var html = menu.closest(".module_content_wrap").html();
                $("body").append(html);
                menu.remove();
            }
        });
    }


    // Menu hint tooltips
    $(".m_hmenu_v2 .li[data-toggle='tooltip']").tooltip({
        toggle:"mouseenter",
        animation:false,
        delay:1000,
        container:'body'
    });


    // tooltip fix for border radius
    $(".m_hmenu_v2 .second-level-items .li:last-child, .m_hmenu_v2 .third-level-items .li:last-child").hover(function() {
        var el = $(this);
        var bottom_left = $(this).css("border-bottom-left-radius");
        var bottom_right = $(this).css("border-bottom-right-radius");
        setTimeout(function() {
            el.css({"border-bottom-left-radius":bottom_left, "border-bottom-right-radius":bottom_right});

            var style = el.attr("style");
            el.attr("style",style+" margin-bottom:0px !important;");
        }, 1000);

        if (el.closest(".ul").hasClass("third-level-items")) {
            setTimeout(function() {
                el.css("margin-bottom","0");
            }, 1000);
        }
    });


    // fix second/third level items so first item doesn't have margin-top/bottom
    $(".m_hmenu_v2 .third-level-items").each(function() {
        var countLi = $(this).find(".li").length;
        if (countLi==1) {
            $(this).find(".li").css("margin-bottom","0px !important");
        }
    });


    // Collect the theme id
    function getThemeId(el) {
        var attrclass = el.closest(".m_hmenu_v2").attr("class");
        return attrclass.replace("m_hmenu_v2 cust", "");
    }


    // Open using hover or click
    function getOpenSubmenuAction(el) {
        var id = getThemeId(el);
        if (open_submenu_action[id] == "hover") {
            var action = "mouseenter";
        }else{
            action = "click";
        }

        return action;
    }


    // Submenu opening/closing effect speed
    function getSubmenuEffectSpeed(id) {
        if (submenu_effect_speed[id] == 'very_slow') {
            var speed = 450;
        }else if (submenu_effect_speed[id] == 'slow') {
            speed = 370;
        }else if (submenu_effect_speed[id] == 'fast') {
            speed = 260;
        }else if (submenu_effect_speed[id] == 'very_fast') {
            speed = 125;
        }

        return speed;
    }


    $(".m_hmenu_v2").find(".level-1.button-selected").each(function() {
        addGapHoverSelected($(this));
    });


    // Function to add gap between hover/seelected
    function addGapHoverSelected(el) {
        var id = getThemeId(el);
        var gap_width = $(".gap.first-gap").width();

        if (gap_width!=0) {
            if (el.next('.gap').is(":visible")) {
                var gap = el.next(".gap");
                var gapl = gap.find(".gap-l");
                var gapr = gap.find(".gap-r");

                gapl.css({"background-color":gapl_c_hs[id]});
                gapr.css({"background-color":gapr_c_hs[id]});
            }

            if (el.prev(".gap").is(":visible")) {
                var gap = el.prev(".gap");
                var gapl = gap.find(".gap-l");
                var gapr = gap.find(".gap-r");

                gapl.css({"background-color":gapl_c_hs[id]});
                gapr.css({"background-color":gapr_c_hs[id]});
            }
        }
    }


    // Function to remove gap between hover/selected
    function removeGapHoverSelected(el) {
        var id = getThemeId(el);
        var index = el.index('.li.level-1');
        var prevIndex = index-1;
        var nextIndex = index+1;

        // do we need to add back a gap image?
        if (gap_image[id]=="") {
            // set back the regular gap colors for the next gap
            if (!$(".li.level-1:eq("+nextIndex+")").hasClass('button-selected') && !$(".li.level-1:eq("+nextIndex+")").hasClass("button-hover")) {
                el.next('.gap').find(".gap-l").css({"background-color":gapl_c[id]});
                el.next('.gap').find(".gap-r").css({"background-color":gapr_c[id]});
            }

            // set back the regular gap colors for the previous gap
            if (!$(".li.level-1:eq("+prevIndex+")").hasClass('button-selected') && !$(".li.level-1:eq("+prevIndex+")").hasClass("button-hover")) {
                el.prev('.gap').find(".gap-l").css({"background-color":gapl_c[id]});
                el.prev('.gap').find(".gap-r").css({"background-color":gapr_c[id]});
            }
        }else{
            // set back the regular image for the next gap
            if (!$(".li.level-1:eq("+nextIndex+")").hasClass('button-selected') && !$(".li.level-1:eq("+nextIndex+")").hasClass("button-hover")) {
                el.next('.gap').css({"background-image":"url("+gap_image[id]+")"});
                el.next('.gap').find(".gap-l").css({"background-color":""});
                el.next('.gap').find(".gap-r").css({"background-color":""});
            }

            // set back the regular image for the previous gap
            if (!$(".li.level-1:eq("+prevIndex+")").hasClass('button-selected') && !$(".li.level-1:eq("+prevIndex+")").hasClass("button-hover")) {
                el.prev('.gap').css({"background-image":"url("+gap_image[id]+")"});
                el.prev('.gap').find(".gap-l").css({"background-color":""});
                el.prev('.gap').find(".gap-r").css({"background-color":""});
            }
        }
    }


    // If action is set to click, make sure the links dont link anywhere
    $(".m_hmenu_v2 .first-level-items").mouseenter(function() {
        var el = $(this);
        var id = getThemeId(el);

        // get action
        var actions = getOpenSubmenuAction(el);
        var action = actions;

        if (action=='click') {
            $(".m_hmenu_v2.cust"+id+" .has_submenu > a").attr("href","javascript:;");
        }
    });


    var delay = (function(){
        var timer = 0;
        return function(callback, ms){
            clearTimeout (timer);
            timer = setTimeout(callback, ms);
        };
    })();


    // Trigger open submenus and button hover
    var submenuDelay = { sub:0, subsub:0 };
    var submenuDelayBtnId = { but:0, sub:0 };
    $(".m_hmenu_v2 .li").mouseenter(function() {
        var el = $(this);
        var id = getThemeId(el);
        var but_id = el.attr("data-id");
        var has_submenu = (el.hasClass("has_submenu"));
        if (el.hasClass("level-1")) var level=1; else if (el.hasClass("level-2")) level=2; else level=3;
        var effect = submenu_effect[id];

        var actions = getOpenSubmenuAction(el);
        var action = actions;

        // open
        if (has_submenu) {
            if (action=='click') {
                el.unbind("click").click(function() {
                    if (level==1) openSubmenu(el);
                    else if (level==2) openSubSubmenu(el);
                });
            }else{
                if (level==1) {
                    submenuDelayBtnId['but'] = but_id;
                    if (but_id == submenuDelayBtnId['but']) clearTimeout(submenuDelay['sub']);
                    openSubmenu(el);
                }else if (level==2) {
                    submenuDelayBtnId['sub'] = but_id;
                    if (but_id == submenuDelayBtnId['sub']) clearTimeout(submenuDelay['subsub']);
                    openSubSubmenu(el);
                }
            }
        }

        // button hover
        el.addClass("button-hover");

        // Gap between hover/selected feature
        if (level==1) {
            var disabled;
            gapl_c_hs[id]=='' ? disabled = true : disabled = false;
            if (!disabled) {
                addGapHoverSelected(el);
            }
        }
    }).mouseleave(function() {
        var el = $(this);
        var id = getThemeId(el);
        var but_id = el.attr("data-id");
        var effect = submenu_effect[id];
        var has_submenu = (el.hasClass("has_submenu"));
        if (el.hasClass("level-1")) var level=1; else if (el.hasClass("level-2")) level=2; else level=3;

        // button hover
        el.removeClass("button-hover");

        if (level==1) {
            if (effect=='slide' || effect=='fade') {
                clearTimeout(submenuDelay['but']);
                submenuDelay['sub'] = setTimeout(function() {
                    closeSubmenu(el);
                }, 500);
            }else{
                closeSubmenu(el);
            }
        }else if (level==2 || level==3) {
            if (effect=='slide' || effect=='fade') {
                clearTimeout(submenuDelay['subsub']);
                submenuDelay['subsub'] = setTimeout(function() {
                    closeSubSubmenu(el);
                }, 500);
            }else{
                closeSubSubmenu(el);
            }
        }

        if (!el.hasClass("button-selected")) {
            removeGapHoverSelected(el);
        }
    });


    // Open level 1 submenus
    function openSubmenu(element) {
        var id = getThemeId(element);
        var effect_speed = getSubmenuEffectSpeed(id);
        var secondLevelBtnCnt = element.find(".second-level-items > .outer-sub-border > .li").length;
        if (secondLevelBtnCnt < 3) {
            var time = effect_speed-30;
        }else{
            time = effect_speed;
        }

        // get action
        var action = getOpenSubmenuAction(element);

        // close other submenus that are opened / opening
        var thisSubmenu = element.find(".second-level-items");
        $(".m_hmenu_v2").find(".second-level-items:visible").not(thisSubmenu).each(function() {
            if (submenu_effect[id] == 'fade') $(this).stop(true).fadeOut(effect_speed);
            else if (submenu_effect[id] == 'slide') $(this).stop(true).slideUp(effect_speed);
            else $(this).css("display","none");
            action != 'click' ? $(this).parent(".li").removeClass("button-hover") : '';
        });

        if (submenu_effect[id] == "instant") {
            element.find(".second-level-items").css("display","block");
        }else if (submenu_effect[id] == "fade") {
            element.find(".second-level-items").fadeIn(effect_speed);
        }else if (submenu_effect[id] == "slide") {
            element.find(".second-level-items").slideDown(time, "linear");
        }
    }


    // Close level 1 submenus
    function closeSubmenu(element) {
        var id = getThemeId(element);
        var effect_speed = getSubmenuEffectSpeed(id);
        var secondLevelBtnCnt = element.find(".second-level-items > .outer-sub-border > .li").length;
        if (secondLevelBtnCnt < 3) {
            var time = effect_speed-30;
        }else{
            time = effect_speed;
        }

        if (submenu_effect[id] == "instant") {
            element.find(".second-level-items").css("display","none");
            $(".third-level-items").css("display","none");
        }else if (submenu_effect[id] == "fade") {
            element.find(".second-level-items").fadeOut(effect_speed);
            $(".third-level-items").fadeOut(effect_speed);
        }else if (submenu_effect[id] == "slide") {
            element.find(".second-level-items").slideUp(effect_speed);
            $(".third-level-items").slideUp(time, "linear");
        }
        $(".second-level-items .li").removeClass("button-hover");
    }


    // Open level 2 submenus
    function openSubSubmenu(element) {
        var id = getThemeId(element);
        var effect_speed = getSubmenuEffectSpeed(id);

        // get action
        var actions = getOpenSubmenuAction(element);
        var action = actions;

        // close other open submenus
        var thisSubmenu = element.find(".third-level-items");
        $(".m_hmenu_v2").find(".third-level-items:visible").not(thisSubmenu).each(function() {
            if (submenu_effect[id] == 'fade') $(this).stop(true).fadeOut(effect_speed);
            else if (submenu_effect[id] == 'slide') $(this).stop(true).slideUp(effect_speed);
            else $(this).css("display","none");
            action != 'click' ? $(this).parent(".li").removeClass("button-hover") : '';
        });

        // calculate the position of the subsubmenu
        var heightAnchor = element.find("a").height();
        var widthBtn = element.width();
        if (element.find(".second-level-items > .outer-sub-border > .li").length==1) { var btnCnt=2; }else{ var btnCnt=element.find(".third-level-items .li").length; }
        var btnIndex = element.closest(".outer-sub-border").children(".li").index(element);
        var paddingRightSub = parseInt(element.closest(".outer-sub-border").css("padding-right"));
        var borderWidth1 = parseInt(element.find(".third-level-items").css("border-left-width"));
        var borderWidth2 = parseInt(element.find(".third-level-items .outer-sub-border").css("border-top-width"));
        var dividerCnt = element.prevAll(".second-level-items > .outer-sub-border > .menu-item-divider").length;
        var dividerHeight = element.siblings(".menu-item-divider").height();
        var htmlHeight = 0;
        for(i=0; i<element.prevAll(".level-2").length; i++) {
            var el = element.closest(".outer-sub-border").find(".level-2:nth-child("+(i+1)+")");
            if (el.hasClass("menu-item-html")) {
                htmlHeight+=el.height();
            }
        }

        // horizontally position subsubmenu
        var addition = widthBtn+paddingRightSub+borderWidth1+borderWidth2+15;

        // vertically position subsubmenu
        if (btnIndex==0) {
            var total = 0-borderWidth1+(dividerCnt*dividerHeight)+(dividerCnt*button_gap_distance_subbut[id])+htmlHeight;
        }else if (dividerCnt==0) {
            total = (heightAnchor*btnIndex)+(button_gap_distance_subbut[id]*btnIndex)-borderWidth1+htmlHeight;
        }else{
            total = (heightAnchor*btnIndex)+(button_gap_distance_subbut[id]*(btnIndex+dividerCnt))+(dividerCnt*dividerHeight)-borderWidth1+htmlHeight;
        }

        var thirdLevelBtnCnt = element.find(".third-level-items > .outer-sub-border > .li").length;
        if (thirdLevelBtnCnt < 3) {
            var time = effect_speed-120;
        }else{
            time = effect_speed;
        }

        // apply calculations
        element.find(".third-level-items").css({"margin-left":addition+"px", "top":total+"px"});

        if (submenu_effect[id] == "instant") {
            element.find(".third-level-items").css("display","block");
        }else if (submenu_effect[id] == "fade") {
            element.find(".third-level-items").fadeIn(effect_speed);
        }else if (submenu_effect[id] == "slide") {
            element.find(".third-level-items").slideDown(time, "linear");
        }
    }


    // Close level 2 submenus
    function closeSubSubmenu(element) {
        var id = getThemeId(element);
        var effect_speed = getSubmenuEffectSpeed(id);
        var thirdLevelBtnCnt = element.find(".third-level-items > .outer-sub-border > .li").length;
        if (thirdLevelBtnCnt < 3) {
            var time = effect_speed-120;
        }else{
            time = effect_speed;
        }

        if (submenu_effect[id] == "instant") {
            element.find(".third-level-items").css("display","none");
        }else if (submenu_effect[id] == "fade") {
            element.find(".third-level-items").fadeOut(effect_speed);
        }else if (submenu_effect[id] == "slide") {
            element.find(".third-level-items").slideUp(time, "linear");
        }
    }


    // Apply correct width to second level bridges
    $(".m_hmenu_v2 .second-level-bridge").each(function() {
        var a_width = $(this).next("a").width();
        var li_pad_left = parseInt($(this).closest(".level-1").css("padding-left"));
        var li_pad_right = parseInt($(this).closest(".level-1").css("padding-right"));
        var h_pos_submenu = parseInt($(this).siblings(".second-level-items").css("margin-left"));
        var add = (a_width+li_pad_right) - h_pos_submenu;
        // apply
        $(this).css({"width":add});
    });


    // Image widget
    var imageTime = {};
    $(".widgets .image-widget").mouseenter(function() {
        var widget = $(this);
        var id = $(this).attr("data-id");
        var img = $(this).find("img:first-child");
        var padding = parseInt(widget.css("padding-left"));
        var newSrc = img.attr("data-hover-src");
        var target = img.attr("data-target");
        var speed = parseInt(img.attr("data-speed"));
        var link = img.closest("a").attr("href");
        if (newSrc!="") {
            clearTimeout(imageTime[id]);
            if (speed=='') {
                img.attr("src",newSrc);
            }else{
                if (widget.find(".img-clone").length == 0) {
                    widget.append("<div class='img-clone' style='position:absolute; left:"+padding+"px; opacity:0;'><a href='"+link+"' target='"+target+"'><img style='max-width:initial;' src='"+newSrc+"' /></a></div>");
                }
                widget.find(".img-container").animate({opacity:0}, speed);
                widget.find(".img-clone").animate({opacity:1}, speed);
            }
        }
    }).mouseleave(function() {
        var widget = $(this);
        var id = $(this).attr("data-id");
        var img = $(this).find("img:first-child");
        var newSrc = img.attr("data-reg-src");
        var speed = parseInt(img.attr("data-speed"));
        if (newSrc!="") {
            clearTimeout(imageTime[id]);
            imageTime[id] = setTimeout(function() {
                if (speed=='') {
                    img.attr("src",newSrc);
                }else{
                    widget.find(".img-container").animate({opacity:1}, speed);
                    widget.find(".img-clone").animate({opacity:0}, speed);

                    //$(":animated").promise().done(function() {
                    //    widget.find(".img-clone").remove();
                    //});
                }
            }, 500);
        }
    });


    // Check if an item is overflowing the menu
    function checkOverflow(element) {
        var topOfMenu = $(".outer-nav-border").offset().top;
        var heightMenu = $(".outer-nav-border").height();
        var bottomOfMenu = topOfMenu+heightMenu;

        if (element.offset().top > bottomOfMenu) {
            return true;
        }else{
            return false;
        }
    }


    /*
    // remove items that have overflown off of the menu
    $(window).load(function() {
        setTimeout(function() {
            $(".m_hmenu_v2 .level-1, .m_hmenu_v2 .each-menu-widget").each(function() {
                if (checkOverflow($(this))) {
                    console.log($(this));
                    if (preview) {
                        $(this).css("display","none");
                        $(".preview-section").css("border", "2px solid #E80000").attr({"data-toggle":"tooltip", "title":"Items are overflowing off of the menu. Please remove any excess items to prevent the menu from breaking."});
                        $.getScript(ajax_js);
                    }
                }
            });
        }, 3500);
    });
    */


    /*
    if ($(".m_hmenu_v2").find(".image-widget").length) {
        var menuHeight = $(".m_hmenu_v2").height();
        var imageHeight = $(".image-widget img").height();
        var isOverflow = $(".m_hmenu_v2").isChildOverflowing('.image-widget');
        if (menuHeight < imageHeight) {
            $(".image-widget img").css("max-height",$(".m_hmenu_v2").height()+"px");
        }
    }
    */


    // Gap between button hover and button selected
    $(".m_hmenu_v2 .li").mouseenter(function() {
        var id = getThemeId($(this));

    }).mouseleave(function() {
        var id = getThemeId($(this));

    });


    // Remove level 2/3 dropdowns if there are no items found within them
    $(".second-level-items, .third-level-items").each(function() {
        if ($(this).find(".li").length == 0 && $(this).find(".menu-item-html").length == 0  && $(this).find(".menu-item-divider").length == 0) {
            $(this).prev("a").find(".dropdown-icon").remove();
            $(this).remove();
        }
    });


    Object.size = function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };


    /*
    var topThisMenu = {};
    var totalTopMenus = 0;
    var loopMenuCount = 0;
    $(window).scroll(function() {
        $(".m_hmenu_v2").each(function() {
            var menu = $(this);
            var ob = $(this).find(".outer-nav-border");
            var id = getThemeId(menu);
            if (ob.css("content")=='fixed') {
                var index = $(".m_hmenu_v2").index(menu);
                var type = ob.css("content");

                if (typeof topThisMenu[id] === 'undefined') topThisMenu[id] = ob.offset().top;

                if (countMenus>1 && preview==0) {
                    // prev
                    var prevMenu = $(document).find(".m_hmenu_v2:eq("+(index-1)+")");
                    var prevOB = prevMenu.find(".outer-nav-border");
                    var prevType = prevOB.css("content");
                    // next
                    var nextMenu = $(document).find(".m_hmenu_v2:eq("+(index+1)+")");
                    var nextOB = nextMenu.find(".outer-nav-border");
                    var nextType = nextOB.css("content");

                    if (totalTopMenus==0) {
                        for (i=0; i<Object.size(topThisMenu); i++) {
                            totalTopMenus += topThisMenu[id];
                        }
                    }

                    // set the menu to fixed
                    if ($(window).scrollTop() > topThisMenu[id]) {
                        ob.css({"position":"fixed", "top":"0px"});
                    }else if ($(window).scrollTop() <= topThisMenu[id]) {
                        ob.css({"position":"absolute", "top":topThisMenu[id]+"px"});
                    }
                }
            }
        });
    });
    */


// End of document
});