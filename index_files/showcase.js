Module_Showcase = {
	images: {},
	
	init: function(preset_id, images) {
		Module_Showcase.images[preset_id] = images;
	},
	
	Slideshow: function(presetId, height, animation, delay){
		var presetId = presetId;
		var height = height;
		var animation = animation;
		var delay = delay;

		//var presetId = presetId + Math.floor(Math.random()*100001);

		var images = Module_Showcase.images[presetId];		
		
		var view = $("#m_showcase_"+presetId+" div.m_showcase_img");
		view.css({"height": height});
		
		var showcaseId = presetId;
		var showcaseHeight = height;			
		
		Module_Showcase.initButtons(presetId, animation);
		
		for (i=0; i < images.length; i++) {
		    var showcase = images[i];
			var url = showcase.img;
			var link = showcase.url;

			var anchor = $('<a href=""></a>');
			anchor.attr('href', link);
			if(showcase.new_window == 1) anchor.attr('target', '_blank');
			$("#m_showcase_"+presetId+" div.m_showcase_img").append(anchor);
			
			var img = $('<img class="m_showcase_img" />')
				.attr('src',url)
				.attr('id',"m_showcase_img_"+presetId+"_" + i)
				.load(function(){
					Module_Showcase.showcaseImgSize($(this), showcaseHeight);				 				
	    		});
	    	
			anchor.append(img);
			
	    	if (i == 0) {
	    		img.show();
			}
		}
		
		changeShowcase = function() {
			if(!$("#m_showcase_"+presetId).data('hover'))
				Module_Showcase.showcaseChange(presetId, "next", animation);
		};
		
		Module_Showcase.updateText(0, presetId);
		
		if (images.length <= 1) {
			$("#m_showcase_"+presetId+" div.m_showcase_view a.button").each(function(){
				$(this).hide();
			});
		} else if ( parseInt(delay,10) ) {
			//$("#m_showcase"+presetId).data('interval', setInterval(changeShowcase, delay * 1000));
			interval = setInterval(changeShowcase , delay * 1000);
			$("#m_showcase_"+presetId).hover(
				function() { $.data(this, 'hover', true); },
				function() { $.data(this, 'hover', false); }
				).data('hover', false);
			$("a.m_showcase_prev, a.m_showcase_next").click(function(){
				/*
				if (animation != "slide") {
					this.parent().parent()
					clearInterval(interval);
				}
				*/
			});	
		}		
		
	},
	
	currentImage: null,
	
	showcaseChange:  function(showcaseId, direction, style) {
		if (Module_Showcase.currentImage == null) {
			Module_Showcase.currentImage = new Array();
		}
		if (Module_Showcase.currentImage[showcaseId] == undefined) {
			Module_Showcase.currentImage[showcaseId] = 0;
		}
		current = Module_Showcase.currentImage[showcaseId];
		
		var end = Module_Showcase.images[showcaseId].length  - 1;
	    if (direction == "prev" && current == 0) {
	    	Module_Showcase.showcaseLoad(end, showcaseId, current , style);
	    	Module_Showcase.currentImage[showcaseId] = end;
	    	return;
	    } else if (direction == "prev") {
	    	Module_Showcase.showcaseLoad(current - 1, showcaseId, current , style);
	    	Module_Showcase.currentImage[showcaseId]--;
	    	return;
	    } else if (direction == "next" && current == end) {
	    	Module_Showcase.showcaseLoad(0, showcaseId,  current , style);
	    	Module_Showcase.currentImage[showcaseId] = 0;
	    	return;
	    } else {
	    	Module_Showcase.showcaseLoad(current + 1, showcaseId, current , style);
	    	Module_Showcase.currentImage[showcaseId]++;
	    	return;
	    }
	},
	
	showcaseImgSize: function(img, height) {
		img.css({width: "100%"});
	},
	
	initButtons: function (showcaseId, style) {
		height = (Math.ceil($("#m_showcase_"+showcaseId).height() - 50)/2) - 30;
		
		$("#m_showcase_"+showcaseId+" div.m_showcase_view a.button").each(function(){
			$(this).css({top: height +"px"});
		});
		
		$("#m_showcase_"+showcaseId+" a.m_showcase_prev").click(function(){
			if (style == "slide") {
				if(Module_Showcase.lastClicked == undefined) Module_Showcase.lastClicked = 0;
				var nowtime = new Date().getTime() / 1000;
				if(nowtime <= Module_Showcase.lastClicked + 0.3) return false;
				else Module_Showcase.lastClicked = nowtime;
				Module_Showcase.showcaseChange(showcaseId, 'prev', 'instant');
				return true;
			}
			Module_Showcase.showcaseChange(showcaseId, 'prev', style);
		});
		
		$("#m_showcase_"+showcaseId+" a.m_showcase_next").click(function(){
			if (style == "slide") {
				if(Module_Showcase.lastClicked == undefined) Module_Showcase.lastClicked = 0;
				var nowtime = new Date().getTime() / 1000;
				if(nowtime <= Module_Showcase.lastClicked + 0.3) return false;
				else Module_Showcase.lastClicked = nowtime;
			}
			Module_Showcase.showcaseChange(showcaseId, 'next', style);
		});
	},

	updateText: function(imageId, showcaseId) {
		var showcase = Module_Showcase.images[showcaseId];
		var title = $("#m_showcase_"+showcaseId+" .m_showcase_bar h3");
		var description = $("#m_showcase_"+showcaseId+" .m_showcase_bar p");
		
		title.html(showcase[imageId].title);
		title.parent().attr('href', showcase[imageId].url);
		if(showcase[imageId].new_window == 1) title.parent().attr('target', '_blank');
		else title.parent().removeAttr('target');
		if ( $("#m_showcase_"+showcaseId).width() >= 250 ) {
			title.css({"font-size": "18px"});
		}
		description.html(showcase[imageId].description);
	},
	
	showcaseLoad:  function (imageId, showcaseId, currentImage, style) {
						
		showcase = Module_Showcase.images[showcaseId];
		var img = $("#m_showcase_img_"+showcaseId+"_"+imageId);
		var current = $("#m_showcase_img_"+showcaseId+"_"+currentImage);
		
		switch (style) {
			case "fade":
				img.fadeIn(400);
				current.fadeOut(400);
				
				Module_Showcase.updateText(imageId, showcaseId);
				break;
			default:
			case "slide":
				var currentWidth = current.width();								
				
				img.css({left: currentWidth});
				img.show();
				img.animate({left: "-="+currentWidth}, 600);
				
				current.animate({left: "-="+currentWidth }, 600);				
												
				Module_Showcase.updateText(imageId, showcaseId);
				break;
			case "slide_fade":
				
				var bar = $("#m_showcase_"+showcaseId+" div.m_showcase_bar");
				barHeight = bar.height();
				barOffset = bar.offset();
				
				bar.animate({bottom: "-="+ barHeight}, 450, function(){
					Module_Showcase.updateText(imageId, showcaseId);
				});
				
				img.fadeIn(700);
				current.fadeOut(700, function(){
					bar.animate({bottom: "+=" + barHeight}, 450);
				});
				
				break;
			case "instant":
				$(".m_showcase_img img").each(function(){
					$(this).hide();
				});
				
				img.show();
				img.css({left: 0});
				Module_Showcase.updateText(imageId, showcaseId);
				break;
		}
	}
};