// ----------------------------------------------------------------------------
// markItUp! Universal MarkUp Engine, JQuery plugin
// v 1.1.x
// Dual licensed under the MIT and GPL licenses.
// ----------------------------------------------------------------------------
// Copyright (C) 2007-2010 Jay Salvat
// http://markitup.jaysalvat.com/
// ----------------------------------------------------------------------------
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
// ----------------------------------------------------------------------------
(function($) {
	$.fn.markItUp = function(settings, extraSettings) {
		var options, ctrlKey, shiftKey, altKey;
		ctrlKey = shiftKey = altKey = false;
	
		options = {	id:						'',
					nameSpace:				'',
					height:                 250,
					root:					'',
					
					/** default markitup preview code, this operates as standard MarkItUp editor */
					previewInWindow:		'', // 'width=800, height=600, resizable=yes, scrollbars=yes'
					previewAutoRefresh:		true,
					previewPosition:		'after',
					previewTemplatePath:	'~/templates/preview.html',
					previewParserPath:		'',
					previewParserVar:		'data',
					
					/** in-place preview for BBCode only **/
					bbCodePreview:			false,
					bbCodePreviewText:		{editor:"Edit", preview:"Preview", menuLabel: "Preview"},
					bbcodePreviewURL:		"/ajax.php?s=bbparser",
					
					resizeHandle:			false,
					beforeInsert:			'',
					afterInsert:			'',
					onEnter:				{},
					onShiftEnter:			{},
					onCtrlEnter:			{},
					onTab:					{},
					markupSet:			[	{ /* set */ } ],
					buttonWidth:            25,     // pixel width of the buttons
					buttonMargin:           2,       // padding/margin on button
					
					textarea: null
				};
		$.extend(options, settings, extraSettings);

		// compute markItUp! path
		if (!options.root) {
			$('script').each(function(a, tag) {
				miuScript = $(tag).get(0).src.match(/(.*)jquery\.markitup(\.pack)?\.js$/);
				if (miuScript !== null) {
					options.root = miuScript[1];
				}
			});
		}

		return this.each(function() {
			var $$, textarea, levels, scrollPosition, caretPosition, caretOffset,
				clicked, hash, header, footer, bucket, bbPreviewLink, bbPreviewDiv, bbPreviewVisible, previewWindow, template, iFrame, abort, lastEvent, popup;			

            $$ = $(this);
            			
			if (options.textarea)
                textarea = options.textarea;
			else
                textarea = this;
                
			levels = [];
			abort = false;
			scrollPosition = caretPosition = 0;
			caretOffset = -1;

			options.previewParserPath = localize(options.previewParserPath);
			options.previewTemplatePath = localize(options.previewTemplatePath);

			// apply the computed path to ~/
			function localize(data, inText) {
				if (inText) {
					return 	data.replace(/("|')~\//g, "$1"+options.root);
				}
				return 	data.replace(/^~\//, options.root);
			}

			// init and build editor
			function init() {
				id = ''; nameSpace = '';
				if (options.id) {
					id = 'id="'+options.id+'"';
				} else if ($$.attr("id")) {
					id = 'id="markItUp'+($$.attr("id").substr(0, 1).toUpperCase())+($$.attr("id").substr(1))+'"';

				}
				if (options.nameSpace) {
					nameSpace = 'class="'+options.nameSpace+'"';
				}
				
				$$.css({height: options.height});

                var buttons = options.buttons || options.markupSet.buttons;
                var groups = buttons.split('|');
                var mkup = [];
                        
				// add the header before the textarea				
				container = header = $('<div class="markItUpHeader"></div>').css({height:groups.length*26}).insertBefore($$);
				// this wrap is a container for the header with relative positioning, so that the popup windows
				// get the correct offset no matter the scroll of the page
				header.wrap('<div style="position:relative"></div>');

				var lastMenuWidth = 0;
				for ( var bg = 0; bg < groups.length; bg++ )
				{
   			        mkup[bg] = [];
   			        var b = groups[bg].split(' ');
   			        var width = 0;
				    for ( var g = 0; g < b.length; g++ )
				    {
    			        if ( typeof options.markupSet[b[g]] === 'object' ) 
    			        {                                                                           
    			            width += ( options.markupSet[b[g]].customWidth ? options.markupSet[b[g]].customWidth : options.buttonWidth )+ options.buttonMargin;
    			            mkup[bg].push(options.markupSet[b[g]]);
    			        }
				    }

				    if(bg > 0) $(dropMenus(mkup[bg])).css({top:(27*bg)+'px'}).appendTo(container);
				    else $(dropMenus(mkup[bg])).appendTo(container);
				    lastMenuWidth = width;
                }   
             
				
				// add the footer after the textarea
				footer = $('<div class="markItUpFooter"></div>').insertAfter($$);
				
				// create a "holding" container outside the header for things like autocomplete popups etc otherwise
				// these can get affected by the UL/LI css of the header itself
				bucket = $('<div class="markitup-bucket"></div>').insertAfter(header)
				
				//wrap the text area in a input-texarea class so the theme styles work
				$$.wrap('<div class="input-textarea"></div>');
 				
				// if there is a bbcode preview enabled then add a link at the end of the menu bar
				if ( options.bbCodePreview )
				{
					// flags which view is currently active:
					//	false - text editing mode
					//	true  - preview mode
					bbPreviewVisible = false;
					
					// create a link to preview in top left of the menu bar
					bbPreviewLink = $('<div class="bbpreview-link"><a href="#">' + options.bbCodePreviewText.preview + '</a></div>');
					bbPreviewLink.find('a').click(bbcodePreview);
					header.append(bbPreviewLink);
					
					// create a hidden div for the title when in preview mode, this will replace
					// the menu toolbar icons
					header.append('<div class="preview-title">' + options.bbCodePreviewText.menuLabel + '</div>');
					
					// create the preview div in the content area
					bbPreviewDiv = $('<div class="bbpreview-body"></div>');					
					bbPreviewDiv.css({height: $$.outerHeight()});

					bbPreviewDiv.insertAfter($$);
					bbPreviewDiv.hide();
				} 				
 
				// add the resize handle after textarea
				if (options.resizeHandle === true && $.browser.safari !== true) {
					resizeHandle = $('<div class="markItUpResizeHandle"></div>')
						.insertAfter($$)
						.bind("mousedown", function(e) {
							var h = $$.height(), y = e.clientY, mouseMove, mouseUp;
							mouseMove = function(e) {
								$$.css("height", Math.max(20, e.clientY+h-y)+"px");
								return false;
							};
							mouseUp = function(e) {
								$("html").unbind("mousemove", mouseMove).unbind("mouseup", mouseUp);
								return false;
							};
							$("html").bind("mousemove", mouseMove).bind("mouseup", mouseUp);
					});
					footer.append(resizeHandle);
				}

				// listen key events
				$$.keydown(keyPressed).keyup(keyPressed);
				
				// bind an event to catch external calls
				$$.bind("insertion", function(e, settings) {
					if (settings.target !== false) {
						get();
					}
					if (textarea === $.markItUp.focused) {
						markup(settings);
					}
				});

				// remember the last focus
				$$.focus(function() {
					$.markItUp.focused = this;
				});
			}

			// recursively build header with dropMenus from markupset
			function dropMenus(markupSet) {
				var ul = $('<ul></ul>'), i = 0;
				$('li:hover > ul', ul).css('display', 'block');
				$.each(markupSet, function() {
					var button = this, t = '', title, li, j;
					title = (button.key) ? (button.name||'')+' [Ctrl+'+button.key+']' : (button.name||'');
					key   = (button.key) ? 'accesskey="'+button.key+'"' : '';
					if (button.separator) {
						li = $('<li class="markItUpSeparator">'+(button.separator||'')+'</li>').appendTo(ul);
					} 
					else {
						i++;
						for (j = levels.length -1; j >= 0; j--) {
							t += levels[j]+"-";
						}
						li = $('<li class="markItUpButton markItUpButton'+t+(i)+' '+(button.className||'')+'"><a href="#" '+key+' data-minitooltip="'+title+'">'+(button.name||'')+'</a></li>')
						.bind("contextmenu", function() { // prevent contextmenu on mac and allow ctrl+click
							return false;
						})/*(function() {
							return false;
						})*/.bind("focusin", function(){
							//   $$.focus();
						}).click(function(event) { lastEvent = event; event.stopPropagation();
							if (button.call) {
								eval(button.call)();
							}
							setTimeout(function() { get(); markup(button) },1);
							return false;
						}).hover(function() {
								$('> ul', this).show();
								$(document).one('click', function() { // close dropmenu if click outside
										$('ul ul', header).hide();
									}
								);
							}, function() {
								$('> ul', this).hide();
							}
						)
						.css( {backgroundPosition: "0px " + (button.buttonIndex * -30) + "px"});
						
						if ( button.customWidth )
						{
						    li.css( {width: button.customWidth} );
						}
						
						li.appendTo(ul);
						button.el = li;

						if (button.dropMenu) {
							levels.push(i);
							$(li).append(dropMenus(button.dropMenu));
						}
					}
				});
				levels.pop();
				return ul;
			}

			// markItUp! markups
			function magicMarkups(string) {
				if (string) {
					string = string.toString();
					string = string.replace(/\(\!\(([\s\S]*?)\)\!\)/g,
						function(x, a) {
							var b = a.split('|!|');
							if (altKey === true) {
								return (b[1] !== undefined) ? b[1] : b[0];
							} else {
								return (b[1] === undefined) ? "" : b[0];
							}
						}
					);
					
					// {input} takes the value in the input field in the popup window
					if ( popup )
					{       
						var val = '';
						
						// if the item has only a single input, pass it	to the method as a scalar
						// otherwise find each field in the prompt list and send values as an object,
						// multiple input values implies that popupValue will be a function
						if ( typeof clicked.popupPrompt === 'object' )
						{			
							var data = {};
							for ( var i =0; i < clicked.popupPrompt.length; i++ )
							{
								var f = popup.find('[name='+clicked.popupPrompt[i].name+']');
								data[clicked.popupPrompt[i].name] = f.val();
							}
							val = clicked.popupValue(data);
						}
						else
						{
							var input = popup.find('input[type=text]')
							if ( input.length ) 
							{
								var v;
								if ( typeof input.attr('data-value') === 'undefined' ) {
									v = input.val();
								} else {
									// if there is an attribute containing the value, assume initially it is a json block,
									// if we cannot decode it then it must be a straight string, so just assign it directly
									var attr = input.attr('data-value');
									try {
										v = $.parseJSON(attr);
									} catch ( e ) {
										v = attr;
									}
								}
								val = typeof clicked.popupValue === 'function' ? clicked.popupValue(v) : v;
							}   
                        }					        
						
						// if this object is taking a URL, ensure the HTTP:// is present
						if ( clicked.isURL && val != "" )
						{
                            var pattern = /^((http|https|ftp):\/\/)/;
							if (!pattern.test(val)) {
                                val = "http://" + val;
                            }
						}
						
						string = string.replace('{input}', val); 
					}
					
					// [![prompt]!], [![prompt:!:value]!]
					string = string.replace(/\[\!\[([\s\S]*?)\]\!\]/g,
						function(x, a) {
							var b = a.split(':!:');
							if (abort === true) {
								return false;
							}
							value = prompt(b[0], (b[1]) ? b[1] : '');
							if (value === null) {
								abort = true;
							}
							return value;
						}
					);
					return string;
				}
				return "";
			}

			// prepare action
			function prepare(action) {
				if ($.isFunction(action)) {
					action = action(hash);
				}
				return magicMarkups(action);
			}

			// build block to insert
			function build(string) {
				var openWith 	= prepare(clicked.openWith);
				var placeHolder = prepare(clicked.placeHolder);
				var replaceWith = prepare(clicked.replaceWith);
				var closeWith 	= prepare(clicked.closeWith);
				if (replaceWith !== "") {
					block = openWith + replaceWith + closeWith;
				} else if (selection === '' && placeHolder !== '') {
					block = openWith + placeHolder + closeWith;
				} else {
					string = string || selection;						
					if (string.match(/ $/)) {
						block = openWith + string.replace(/ $/, '') + closeWith + ' ';
					} else {
						block = openWith + string + closeWith;
					}
				}
				return {	block:block, 
							openWith:openWith, 
							replaceWith:replaceWith, 
							placeHolder:placeHolder,
							closeWith:closeWith
					};
			}
            
            function showPopup()
            {
                if ( popup ) {
					popup.remove();
				}
				
				var width = (typeof clicked.popupConfig === 'object' && typeof clicked.popupConfig.width !== 'undefined' ? 'style="width:'+clicked.popupConfig.width+'px"' : '');
				var css = (typeof clicked.popupClass !== 'undefined' ? clicked.popupClass : '');
				html = '<div class="bbcode-toolbar-popup markitup-popup element_popup hidden '+css+'" '+width+'><div class="inner"></div>';
				popup = $(html).appendTo( bucket );
				popup.click( function(event) { event.stopPropagation(); } );                    
               
                var offset = header.offset();
                var elOffset = $(lastEvent.currentTarget).offset();
                var left = elOffset.left - offset.left;
                var top = elOffset.top - offset.top;
                
                if ( typeof clicked.popupPrompt !== 'undefined' )
                {
					if ( typeof clicked.popupType !== 'undefined' && clicked.popupType == 'search-wow-item' ) {
						var html = '<div class="prompt"><div class="content"><div class="label">' + clicked.popupPrompt + ':</div><div class="input input-text"><input type=text name="item"></div>' + clicked.popupContent(options) + '</div><div class="footer"><div class="element_button" style="margin-top:4px;"><div class="l"><!-- --></div><div class="r"><!-- --></div><input type="button" value="' + clicked.popupButton + '"></div></div></div>';
                    	popup.children('.inner').html(html);
						popup.children('.inner').find('input[type=text]').asmAutocomplete({
								maxItems: 1,
								autocompleteClass: 'markitup-autocomplete',
								removeClass: 'asmListItemRemove remove-wow-item',
								containerClass:'wow-item-container',
								source: '/ajax.php?s=games&cmd=search-wow-items',
								searchParams: function() {
												var stats = popup.children('.inner').find('select[name=stats]')[0].asmGetSelected().join(',');
												if ( stats == 'none' ) {
													stats = '';
												}

												return {
													difficulty: popup.children('.inner').find('select[name=level]')[0].asmGetSelected().join(','),
													stat: stats,
													level: popup.children('.inner').find('.manual-container input').val()
												}
											},
								displayFormatter: function(data) {
									var name = data.value.item_name;
									if ( data.value.item_difficulty != 'normal' ) {
										name += ' ('+(data.value.item_difficulty == 'raid-finder' ? 'Raid Finder' : data.value.item_difficulty.charAt(0).toUpperCase() + data.value.item_difficulty.slice(1))+')';
									}
									var class_q = '';
									var style = '';
									var color = popup.find('.color[data-color]');
									if ( color.length > 0 && color.attr('data-color') != '' ) {
										style = ' style="color:'+color.attr('data-color')+'"';
									} else if (  data.value.item_quality ) {
										class_q = ' q' + data.value.item_quality;
									}
									data.label = '<div class="wow-item-wrapper"><div class="wow-item-icon" style="background-image:url(http://wowimg.zamimg.com/images/wow/icons/small/'+data.value.item_icon+')"><div class="wow-item-icon-border"></div></div><div class="wow-item-name'+class_q+'" '+style+'>' + name + '</div><div class="clearing"></div></div>';
								},
								onAdd: function(item,el) {
									var color = popup.find('.color[data-color]');
									if ( color.length > 0 && color.attr('data-color') != '' ) {
										el.find('.wow-item-name').css('color', color.attr('data-color'));
									} else {
										el.find('.wow-item-name').addClass( 'q' + item.value.item_quality );
									}
								}
							});
						popup.find('.inner select[name=level]').asmSelect({
																	onAdd:function(item) {
																				var rel = item.attr('id');
																				var value = item.attr('value');
																				if ( value == 'manual' ) {
																					var li = popup.find('.inner select[name=level]').prev('ol').find('li[rel='+rel+']');
																					li.after('<li class="manual-container"><div class="input-text title">ilvl</div><div class="input input-text"><input type=text /></div></li>');
																				}
																			},
																	onRemove: function(item) {
																				var value = item.attr('value');
																				if ( value == 'manual' ) {
																					popup.find('.inner select[name=level]').prev('ol').find('li.manual-container').remove();
																				}
																			}
																				
																});
						popup.find('.inner select[name=stats]').asmSelect({
																	onAdd:function(item) {
																			// if the user puts the "None" item in the list the forceably remove all the others
																			// this item is really mutually exclusive to all the others
																			var select = popup.find('.inner select[name=stats]');
																			if ( item.attr('value') == 'none' ) {
																				select.find('option[value!=none]').each( function() { select[0].asmRemoveListItem($(this).attr('value')); } );
																			} else {
																				select[0].asmRemoveListItem('none');
																			}
																		}
																});
						
						// custom color popup
						popup.find('.color .button').click( function() {
																var html = '<div class="bbcode-toolbar-popup markitup-popup element_popup"><div class="inner">';
																html += '<div class="colors"><div class="target swatch-default" data-color="">[Default]</div>';
																var colors = [
																				'eeeeee', 'bebebe', '989898', '7a7a7a', '4e4e4e', '3e3e3e', '282828', '181818',
																				'f3b2b1', 'f3d9b1', 'f3efb1', 'caf3b1', 'b1dcf3', 'b1c6f3', 'ccb1f3', 'eeacf9',
																				'dd2423', 'dd9323', 'ddd123', '6cdd23', '239edd', '2360dd', '6e23dd', 'd113ee',
																				'761413', '764f13', '767013', '3a7613', '135476', '133376', '3b1376', '6f0a7f'
																			];
																for ( var i = 0; i < colors.length; i++ ) { html += '<div data-color="#' + colors[i] + '" class="swatch target" style="background: #' + colors[i] + ';" <!-- --></div>'; }
																html + "</div></div>";

																var color_popup = $(html).appendTo( $(this) );
																color_popup.click( function(event) { event.stopPropagation(); } );
																color_popup.find('.target').click( function() {
																									var item = popup.find('.wow-item-container .asmList li').attr('rel');
																									if ( typeof item !== 'undefined' ) {
																										item = $.parseJSON(item);
																									}

																									var color = $(this).attr('data-color');
																									if ( color == '' ) {
																										popup.find('.color').removeAttr('data-color');
																										if ( typeof item !== 'undefined' ) {
																											popup.find('.wow-item-container .asmList .wow-item-name').addClass( 'q' + item.item_quality ).css('color', false);
																										}
																									} else {
																										popup.find('.color').attr('data-color', color);
																										popup.find('li .wow-item-name').css('color', color);
																										if ( typeof item !== 'undefined' ) {
																											popup.find('li .wow-item-name').removeClass( 'q' + item.item_quality );
																										}
																									}			
																									
																									color_popup.fadeOut(160); 
																									return false; 
																								});
															});
														
                    	popup.find('input[type=button]').click( function() {
																	var color = popup.find('.color').attr('data-color');

																	// find the item selected, if there is none we insert nothing
																	var picker = popup.children('.inner').find('input[name=item]');
																	var item = picker[0].asmGetSelected();

																	// limit the stats shown on the tooltip to those in the stat filter
																	var stat_picker = popup.children('.inner').find('select[name=stats]');
																	var show_stats = stat_picker[0].asmGetSelected();

																	if ( item.length == 0 ) {
																		clicked.openWith = '';
																		clicked.closeWith = '';
																	} else {
																		item = item.pop();
																		clicked.openWith = '[wowitem=' + item.item_external_id;
																		var bonus = [];
																		if ( typeof color !== 'undefined' && color != '' ) {
																			clicked.openWith += ' color=' + color;
																		}
																		if ( item.item_difficulty != 'normal' ) {
																			bonus.push(item.item_difficulty);
																		}
																		if ( item.item_stats != "" ) {
																			var stats = item.item_stats.split(',');
																			for ( var s = 0; s < stats.length; s++ ) {
																				// only show stats that have been filtered in, either all or the individual
																				// ones selected in the stat dropdown widget
																				if ( show_stats.length == 0 || $.inArray(stats[s],show_stats) >= 0 ) {
																					bonus.push(stats[s]);
																				}
																			}
																		}
																		if ( bonus.length > 0 ) {
																			clicked.openWith += ' bonus='+bonus.join(':');
																		}
																		clicked.openWith += ']' + item.item_name;
																		clicked.closeWith = '[/wowitem]';
																	}
																	
																	popup.fadeOut(160); 
																	set(clicked.caretPosition,clicked.selection.length); 
																	markup(); 
																});
					} else if ( typeof clicked.popupType !== 'undefined' && clicked.popupType == 'search-swtor-item' ) {
						var html = '<div class="prompt"><div class="content"><div class="label">' + clicked.popupPrompt + ':</div><div class="input input-text"><input type=text name="item"></div>' + clicked.popupContent(options) + '</div><div class="footer"><div class="element_button" style="margin-top:4px;"><div class="l"><!-- --></div><div class="r"><!-- --></div><input type="button" value="' + clicked.popupButton + '"></div></div></div>';
                    	popup.children('.inner').html(html);
						popup.children('.inner').find('input[type=text]').asmAutocomplete({
								maxItems: 1,
								autocompleteClass: 'markitup-autocomplete',
								removeClass: 'asmListItemRemove remove-wow-item',
								containerClass:'wow-item-container',
								source: '/ajax.php?s=games&cmd=search-swtor-items',
								displayFormatter: function(data) {
									var name = data.value.item_name;
									var class_q = '';
									var style = '';
									class_q = ' torctip_' + data.value.item_quality;
									data.label = '<div class="wow-item-wrapper"><div class="torctip_image torctip_image_'+data.value.item_quality+' small_border" style="display: inline-block;float:left;"><img src="https://torcommunity.com/db/icons/'+data.value.item_icon+'" class="small_image"></div><div class="wow-item-name'+class_q+'" '+style+'>' + name + '</div><div class="clearing"></div></div>';
								},
								onAdd: function(item,el) {
									el.find('.wow-item-name').addClass( 'torctip_' + item.value.item_quality );
								}
							});
														
                    	popup.find('input[type=button]').click( function() {
																	// find the item selected, if there is none we insert nothing
																	var picker = popup.children('.inner').find('input[name=item]');
																	var item = picker[0].asmGetSelected();

																	if ( item.length == 0 ) {
																		clicked.openWith = '';
																		clicked.closeWith = '';
																	} else {
																		item = item.pop();
																		clicked.openWith = '[torcom=' + item.game_item_id + ']' + item.item_name;
																		clicked.closeWith = '[/torcom]';
																	}
																	
																	popup.fadeOut(160); 
																	set(clicked.caretPosition,clicked.selection.length); 
																	markup(); 
																});
					
					} else if ( typeof clicked.popupType !== 'undefined' && clicked.popupType == 'search-game-item' ) {
						var html = '<div class="prompt"><div class="label">' + clicked.popupPrompt + ':</div><div class="input input-text"><input type=text></div><div class="element_button" style="margin-top:4px;"><div class="l"><!-- --></div><div class="r"><!-- --></div><input type="button" value="' + clicked.popupButton + '"></div></div>';
                    	popup.children('.inner').html(html);
						var cache = {}, lastXhr;
						if ( $('.markitup-autocomplete').length == 0 ) { popup.closest('.markitup-bucket').parent().append('<div class="markitup-autocomplete"></div>'); }
						$('.markitup-autocomplete').removeClass('small');
						popup.children('.inner').find('input[type=text]').autocomplete({
							minLength: 1,
							html: true,
							appendTo: $('.markitup-autocomplete'),
							source: function( request, response ) {
								var term = request.term;
								if (term in cache) {
									response( cache[ term ] );
									return;
								}
								lastXhr = $.getJSON('/ajax.php?s=games&cmd=search-game-items&g=' + clicked.game_id, request, function(data, status, xhr) {
									cache[ term ] = data;
									if (xhr === lastXhr) response(data);
								});
							},
							select: function(event, ui) {
								$(this).attr('data-value', ui.item.sval);
								$(this).attr('data-name', ui.item.value);
								event.cancelBubble = true;
								if (event.stopPropagation) event.stopPropagation();		
							}
						});

                    	popup.find('input[type=button]').click( function() { popup.fadeOut(160); set(clicked.caretPosition,clicked.selection.length); markup(); } );
					}
					else if ( typeof clicked.popupType !== 'undefined' && clicked.popupType == 'search-users' ) {
						var html = '<div class="prompt"><div class="label">' + clicked.popupPrompt + ':</div><div class="input input-text"><input type=text></div><div class="element_button" style="margin-top:4px;"><div class="l"><!-- --></div><div class="r"><!-- --></div><input type="button" value="' + clicked.popupButton + '"></div></div>';
                    	popup.children('.inner').html(html);
						var cache = {}, lastXhr;
						if ( $('.markitup-autocomplete').length == 0 ) { 
							popup.closest('.markitup-bucket').parent().append('<div class="markitup-autocomplete"></div>'); 
						} else {
							$('.markitup-autocomplete').empty();
						}						
						$('.markitup-autocomplete').addClass('small');
						popup.children('.inner').find('input[type=text]').autocomplete({
							minLength: 1,
							appendTo: $('.markitup-autocomplete'),
							html: true,
							source: function( request, response ) {
								var term = request.term;
								if (term in cache) {
									response( cache[ term ] );
									return;
								}
								lastXhr = $.getJSON('/ajax.php?s=forum&cmd=search-users' + (typeof options.thread_id !== 'undefined' ? '&thread_id='+options.thread_id : ''), request, function(data, status, xhr) {
									cache[ term ] = data;
									if (xhr === lastXhr) response(data);
								});
							},
							select: function(event, ui) { 
								$(this).attr('data-value', ui.item.sval);
								$(this).attr('data-name', ui.item.value);
							}
						});	

                    	popup.find('input[type=button]').click( function() { popup.fadeOut(160); set(clicked.caretPosition,clicked.selection.length); markup(); } );
					}
					else 
					{								
						var html = '';
						if ( typeof clicked.popupPrompt === 'object' )	// actually it must be an array
						{
							html += '<div class="prompt auto">';
							for ( var i = 0; i < clicked.popupPrompt.length; i++ )
							{
								var alignLeft = (typeof clicked.popupConfig === 'object' && clicked.popupConfig.labelAlign == 'left');
								var labelWidth = (typeof clicked.popupConfig == 'object' && clicked.popupConfig.labelWidth ? 'style="width:'+clicked.popupConfig.labelWidth+'px"' : '');
								var inputClass = (typeof clicked.popupPrompt[i].cls !== 'undefined' ? clicked.popupPrompt[i].cls : '');
								
								var attrs = 'name="'+clicked.popupPrompt[i].name+'" ';
								if ( typeof clicked.popupPrompt[i].attrs === 'object' ) { for ( var n in clicked.popupPrompt[i].attrs ) { attrs += n+'="'+clicked.popupPrompt[i].attrs[n]+'" '; } }
								var input = '<div class="' + (alignLeft ? 'label-left ' : '') + inputClass + ' input input-text"><input type="text" '+attrs+'/></div>';
								if ( alignLeft ) { html += '<div class="row">'; }
								html += '<div '+labelWidth+' class="' + (alignLeft ? 'label-left ' : '') + 'label">' + clicked.popupPrompt[i].label + ':</div>' + input;
								if ( alignLeft ) { html += '</div>'; }
							}	
						}
						else
						{
							html += '<div class="prompt">';
							html += '<div class="label">' + clicked.popupPrompt + ':</div><div class="input input-text"><input type=text></div>';
						}	
						html += '<div class="element_button" style="margin-top:4px;"><div class="l"><!-- --></div><div class="r"><!-- --></div><input type="button" value="' + clicked.popupButton + '"></div>';
						html += '</div>';                    	
						
						popup.children('.inner').html(html);
                    	popup.find('input[type=button]').click( function() { popup.fadeOut(160); set(clicked.caretPosition,clicked.selection.length); markup(); } );
					}
                }
                else
                {
                    popup.children('.inner').html( typeof clicked.popupContent === 'function' ? clicked.popupContent(options) : clicked.popupContent );
                    popup.find('.target').click( function() { clicked.openWith = $(this).attr('data-open'); clicked.closeWith = $(this).attr('data-close'); set(clicked.caretPosition,clicked.selection.length);  popup.fadeOut(160);  markup(); return false; } );
                }
                
            	popup.css( {left: left + 4 , top: top + 24} ).fadeIn(160, function(){ popup.children('.inner').find('input[type=text]').focus(); });
            	var bounds = popup.offset();
            	
            	if (bounds.top + popup.outerHeight() - $(window).scrollTop() > $(window).height()) {
            	    popup.css('top', top - popup.outerHeight());
            	}
                
				// if we click outside the popup close the window, only response to left-clicks, right/middle click does not close popup
				// also don't close if the click is on a jquery-ui autocomplete menu, v1.10 breaks if we stop event propagation, but
				// if we let the event bubble down the popup will close, so for now a fix must be to check for jquery menu in click handler
				var closeHandler = function(ev) { 
					if (ev.button == 0 ) { 
							if ( popup && !$(ev.target).hasClass('ui-corner-all') && !$(ev.target).closest('.ui-menu').length ) { 	
								popup.fadeOut(160); 
							} 
					} else {  
						$(document).one('click', closeHandler); 
					} 
				}; 
                $(document).one('click', closeHandler);
            }
            
			// define markup to insert
			function markup(button) {
				var len, j, n, i;

				if ( typeof button !== 'undefined' )
				{
    				hash = clicked = button;
    				//get();
					if ( typeof selection === 'undefined' ) {
						selection = '';
					}
					
    				$.extend(hash, {	line:"", 
    						 			root:options.root,
    									textarea:textarea, 
    									selection:(selection||''), 
    									caretPosition:caretPosition,
    									ctrlKey:ctrlKey, 
    									shiftKey:shiftKey, 
    									altKey:altKey
    								}
    							);
                    
                    if ( typeof button.popupContent !== 'undefined' || typeof button.popupPrompt !== 'undefined')
                    {
                        showPopup();
                        return;
                    }
                }
                                                							
				// callbacks before insertion
				prepare(options.beforeInsert);
				prepare(clicked.beforeInsert);
				if (ctrlKey === true && shiftKey === true) {
					prepare(clicked.beforeMultiInsert);
				}			
				$.extend(hash, { line:1 });
				
				if (ctrlKey === true && shiftKey === true) {
					lines = selection.split(/\r?\n/);
					for (j = 0, n = lines.length, i = 0; i < n; i++) {
						if ($.trim(lines[i]) !== '') {
							$.extend(hash, { line:++j, selection:lines[i] } );
							lines[i] = build(lines[i]).block;
						} else {
							lines[i] = "";
						}
					}
					string = { block:lines.join('\n')};
					start = caretPosition;
					len = string.block.length + (($.browser.opera) ? n-1 : 0);
				} else if (ctrlKey === true) {
					string = build(selection);
					start = caretPosition + string.openWith.length;
					len = string.block.length - string.openWith.length - string.closeWith.length;
					len = len - (string.block.match(/ $/) ? 1 : 0);
					len -= fixIeBug(string.block);
				} else if (shiftKey === true) {
					string = build(selection);
					start = caretPosition;
					len = string.block.length;
					len -= fixIeBug(string.block);
				} else {
					string = build(selection);
					start = caretPosition + string.block.length ;
					len = 0;
					
					// check to see if the markup set requested a custom offset to the caret position
					// caretOffset can be a function or a scalar value, valid settings are:
					// < 0 => move caret backwards [n] characters from the end of the markup string
					// > 0 => move caret forwards [n] characters from the start of the markup string
					//   0 => do nothing
					var o = 0;
					if ( typeof button !== 'undefined' && $.isFunction(button.caretOffset) ) {
						o = button.caretOffset(hash);
					} else if ( typeof button !== 'undefined' && typeof button.caretOffset !== 'undefined' ) {
						o = button.caretOffset;
					}
					if ( o < 0 ) {
						// its negative, start is the end of the markup block, so adding the offset to start
						// will draw the caret back o characters from the end of the markup
						start += o;									
					} else if ( o > 0 ) {
						// its positive, so move caret to o characters from beginning of the markup
						start = caretPosition + o;
					}	
					
					start -= fixIeBug(string.block);
				}
				if ((selection === '' && string.replaceWith === '')) {
					caretOffset += fixOperaBug(string.block);
					
					start = caretPosition + string.openWith.length;
					len = string.block.length - string.openWith.length - string.closeWith.length;

					caretOffset = $$.val().substring(caretPosition,  $$.val().length).length;
					caretOffset -= fixOperaBug($$.val().substring(0, caretPosition));
				}
				$.extend(hash, { caretPosition:caretPosition, scrollPosition:scrollPosition } );

				if (string.block !== selection && abort === false) {
					insert(string.block);
					set(start, len);
				} else {
					caretOffset = -1;
				}
				//get();

				$.extend(hash, { line:'', selection:selection });

				// callbacks after insertion
				if (ctrlKey === true && shiftKey === true) {
					prepare(clicked.afterMultiInsert);
				}
				prepare(clicked.afterInsert);
				prepare(options.afterInsert);

				// refresh preview if opened
				if (previewWindow && options.previewAutoRefresh) {
					refreshPreview(); 
				}
																									
				// reinit keyevent
				shiftKey = altKey = ctrlKey = abort = false;
			}

			// Substract linefeed in Opera
			function fixOperaBug(string) {
				if ($.browser.opera) {
					return string.length - string.replace(/\n*/g, '').length;
				}
				return 0;
			}
			// Substract linefeed in IE
			function fixIeBug(string) {
				if ($.browser.msie) {
					return string.length - string.replace(/\r/g, '').length;
				}
				return 0;
			}
				
			// add markup
			function insert(block) {	
				if (document.selection) {
					var newSelection = document.selection.createRange();
					newSelection.text = block;
				} else 
				{
					// if the selection came from the text area, replace the selected text with the block, so basically
					// when doing substring, leave out the selection, but it if came from the document, we insert into
					// the caret position, so just start 1 after current caret pos
					var offset = textarea_selection ? caretPosition + selection.length : caretPosition;
					textarea.value =  textarea.value.substring(0, caretPosition)  + block + textarea.value.substring(offset, textarea.value.length);
				}
			}

			// set a selection
			function set(start, len) {
				if (textarea.createTextRange){
					// quick fix to make it work on Opera 9.5
					if ($.browser.opera && $.browser.version >= 9.5 && len == 0) {
						return false;
					}
					range = textarea.createTextRange();
					range.collapse(true);
					range.moveStart('character', start); 
					range.moveEnd('character', len); 
					range.select();
				} else if (textarea.setSelectionRange ){
					textarea.setSelectionRange(start, start + len);
				}
				textarea.scrollTop = scrollPosition;
				textarea.focus();
			}

			function getSelText() 
			{
			  var txt = '';
			  if (window.getSelection) {
				txt = window.getSelection().toString();
			  } else if (document.getSelection) {
				txt = document.getSelection().toString();
			  } else if (document.selection) {
				txt = document.selection.createRange().text;
			  } 
			  return txt;
			}			
			
			// get the selection
			function get() {
				
				selection = getSelText();
				textarea_selection = false;
				
				textarea.focus();				
				scrollPosition = textarea.scrollTop;
				if (document.selection) {
					var s = document.selection;	
					if ($.browser.msie) { // ie	
						var range = s.createRange();
						var stored_range = range.duplicate();
						try{ stored_range.moveToElementText(textarea); } catch(e){} //this is a hack, since when selection is null will happen this, check later
						stored_range.setEndPoint('EndToEnd', range);
						var s = stored_range.text.length - range.text.length;
	
						caretPosition = s - (textarea.value.substr(0, s).length - textarea.value.substr(0, s).replace(/\r/g, '').length);
						if ( selection == '' ) { textarea_selection = true; selection = range.text; }
					} else { // opera
						caretPosition = textarea.selectionStart;
					}
				} else { // gecko & webkit
					caretPosition = textarea.selectionStart;
					if ( selection == '' ) { textarea_selection = true; selection = textarea.value.substring(caretPosition, textarea.selectionEnd); }
				} 
				return selection;
			}

			// handle the custom bbcode preview
			function bbcodePreview()
			{
				if ( bbPreviewVisible ) 
				{
					
					bbPreviewLink.find('a').text( options.bbCodePreviewText.preview );		// restore link to preview area text					
					bbPreviewDiv.hide();	// hide bbcode preview block					
					$$.show();				// show the textarea editor again
					header.find('ul').show();		// show the menu again
					header.find('.preview-title').hide();			// hide the preview title
					bbPreviewVisible = false;	// flag we are in editor mode
				}
				else
				{
					bbPreviewLink.find('a').text( options.bbCodePreviewText.editor );		 // show return to edit text
					$$.hide();											// hide text editor				
					header.find('ul').hide();		// hide the menu bar
					header.find('.preview-title').show();			// show the preview title
					
					// show preview div with a loading msg in it
					bbPreviewDiv.html('<div style="text-align:center;padding-top:16px">Loading...</div>')					
					bbPreviewDiv.show();			
					
					// flag that we are in preview mode
					bbPreviewVisible = true;
					
					// get the server to parse the bbcode then put the result in the preview window
					$.post(options.bbcodePreviewURL, {text:$$.val()}, function(bbcode) { bbPreviewDiv.html(bbcode); });
				}
				
				return false;
			}
			
			// open preview window
			function preview() {
				if (!previewWindow || previewWindow.closed) {
					if (options.previewInWindow) {
						previewWindow = window.open('', 'preview', options.previewInWindow);
						$(window).unload(function() {
							previewWindow.close();
						});
					} else {
						iFrame = $('<iframe class="markItUpPreviewFrame"></iframe>');
						if (options.previewPosition == 'after') {
							iFrame.insertAfter(footer);
						} else {
							iFrame.insertBefore(header);
						}	
						previewWindow = iFrame[iFrame.length - 1].contentWindow || frame[iFrame.length - 1];
					}
				} else if (altKey === true) {
					if (iFrame) {
						iFrame.remove();
					} else {
						previewWindow.close();
					}
					previewWindow = iFrame = false;
				}
				if (!options.previewAutoRefresh) {
					refreshPreview(); 
				}
				if (options.previewInWindow) {
					previewWindow.focus();
				}
			}

			// refresh Preview window
			function refreshPreview() {
 				renderPreview();
			}

			function renderPreview() {		
				var phtml;
				if (options.previewParserPath !== '') {
					$.ajax({
						type: 'POST',
						dataType: 'text',
						global: false,
						url: options.previewParserPath,
						data: options.previewParserVar+'='+encodeURIComponent($$.val()),
						success: function(data) {
							writeInPreview( localize(data, 1) ); 
						}
					});
				} else {
					if (!template) {
						$.ajax({
							url: options.previewTemplatePath,
							dataType: 'text',
							global: false,
							success: function(data) {
								writeInPreview( localize(data, 1).replace(/<!-- content -->/g, $$.val()) );
							}
						});
					}
				}
				return false;
			}
			
			function writeInPreview(data) {
				if (previewWindow.document) {			
					try {
						sp = previewWindow.document.documentElement.scrollTop
					} catch(e) {
						sp = 0;
					}	
					previewWindow.document.open();
					previewWindow.document.write(data);
					previewWindow.document.close();
					previewWindow.document.documentElement.scrollTop = sp;
				}
			}
			
			// set keys pressed
			function keyPressed(e) { 
				shiftKey = e.shiftKey;
				altKey = e.altKey;
				ctrlKey = (!(e.altKey && e.ctrlKey)) ? e.ctrlKey : false;

				if (e.type === 'keydown') {
					if (ctrlKey === true) {
						li = $('a[accesskey="'+((e.keyCode == 13) ? '\\n' : String.fromCharCode(e.keyCode))+'"]', header).parent('li');
						if (li.length !== 0) {
							ctrlKey = false;
							setTimeout(function() {
								li.triggerHandler('mousedown');
							},1);
							return false;
						}
					}
					if (e.keyCode === 13 || e.keyCode === 10) { // Enter key
						if (ctrlKey === true) {  // Enter + Ctrl
							ctrlKey = false;
							markup(options.onCtrlEnter);
							return options.onCtrlEnter.keepDefault;
						} else if (shiftKey === true) { // Enter + Shift
							shiftKey = false;
							markup(options.onShiftEnter);
							return options.onShiftEnter.keepDefault;
						} else { // only Enter
							markup(options.onEnter);
							return options.onEnter.keepDefault;
						}
					}
					if (e.keyCode === 9) { // Tab key
						if (shiftKey == true || ctrlKey == true || altKey == true) {
							return false; 
						}
						if (caretOffset !== -1) {
							get();
							caretOffset = $$.val().length - caretOffset;
							set(caretOffset, 0);
							caretOffset = -1;
							return false;
						} else {
							markup(options.onTab);
							return options.onTab.keepDefault;
						}
					}
				}
			}

			init();
		});
	};

	$.fn.markItUpRemove = function() {
		return this.each(function() {
				var $$ = $(this).unbind().removeClass('markItUpEditor');
				$$.parent('div').parent('div.markItUp').parent('div').replaceWith($$);
			}
		);
	};

	$.markItUp = function(settings) {
		var options = { target:false };
		$.extend(options, settings);
		if (options.target) {
			return $(options.target).each(function() {
				$(this).focus();
				$(this).trigger('insertion', [options]);
			});
		} else {
			$('textarea').trigger('insertion', [options]);
		}
	};
})(jQuery);
