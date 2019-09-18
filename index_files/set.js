// ----------------------------------------------------------------------------
// markItUp!
// ----------------------------------------------------------------------------
// Copyright (C) 2008 Jay Salvat
// http://markitup.jaysalvat.com/
// ----------------------------------------------------------------------------
// BBCode tags example
// http://en.wikipedia.org/wiki/Bbcode
// ----------------------------------------------------------------------------
// Feel free to add more tags
// ----------------------------------------------------------------------------
if ( typeof MarkItUp !== 'object' ) { MarkItUp = {}; }
MarkItUp.BBCode = {
	previewParserPath:	'', // path to your BBCode parser
	resizeHandle: false,
	previewAutoRefresh: false,

	buttons:  "removeformat size color smiley link quote image youtube attach spoiler email code noparse warning | " +
	"bold italic underline highlight strikethrough superscript subscript alignleft center alignright justify bullets numbering outdent indent table line columns twitch",

	markupSet: {
            	"removeformat": {name:'Clean', className:"clean icon-trash", buttonIndex:0, replaceWith:function(markitup) { return markitup.selection.replace(/\[(.*?)\]/g, "") } },
        		"size": {name:'Size', className:"icon-font", key:'S',
        		         popupContent: function()
        		                        {
        		                            var html = '<div class="sizes"><table>' + 
                                                			'<tr class="target" data-open="[size=1]" data-close="[/size]"><td class="txt" width="50px">Tiny</td><td class="a" style="font-size: 0.67em;">A</td></tr>' +
                                                			'<tr class="target" data-open="[size=2]" data-close="[/size]"><td class="txt">Small</td><td class="a" style="font-size: 0.83em;">A</td></tr>' +
                                                			'<tr class="target" data-open="[size=3]" data-close="[/size]"><td class="txt">Normal</td><td class="a">A</td></tr>' +
                                                			'<tr class="target" data-open="[size=5]" data-close="[/size]"><td class="txt">Large</td><td class="a" style="font-size: 1.5em;">A</td></tr>' +
                                                			'<tr class="target" data-open="[size=6]" data-close="[/size]"><td class="txt">Huge</td><td class="a" style="font-size: 2em;">A</td></tr>' +
                                                		'</table></div>';
                                            return html;
        		                        }
        		        ,buttonIndex:1
                        },
              "color": { name:'Colors', className:"icon-brush",
                         popupContent: function() 
                                        { 	

                                            var html = '<div class="colors">';
                                    		var colors = [
                                                			'eeeeee', 'bebebe', '989898', '7a7a7a', '4e4e4e', '3e3e3e', '282828', '181818',
                                                			'f3b2b1', 'f3d9b1', 'f3efb1', 'caf3b1', 'b1dcf3', 'b1c6f3', 'ccb1f3', 'eeacf9',
                                                			'dd2423', 'dd9323', 'ddd123', '6cdd23', '239edd', '2360dd', '6e23dd', 'd113ee',
                                                			'761413', '764f13', '767013', '3a7613', '135476', '133376', '3b1376', '6f0a7f'
                                                        ];
		                                    for ( var i = 0; i < colors.length; i++ ) { html += 
'<div data-open="[color=#' + colors[i] + ']" data-close="[/color]" class="swatch target" style="background: #' + colors[i] + '"></div>'; }
		                                    return html + "</div>";
                                        }, 
                         buttonIndex:2
                       },
        	"smiley": { name:'Insert Smiley', className:"icon-smile"
        	           ,popupContent: function(options)
        	                          {
        	                             var html = '<div class="smileys">';
        	                             for ( var s in options.smileys )
        	                             {
        	                                //var text = options.smileys[s].text.replace('"','&quot;');
											 var text = $('<pre>').text(options.smileys[s].text).html();
        	                                html += '<img data-open=" ' + text + ' " class="smiley_icon target" src="' + options.smileys[s].icon + '" title="' + text + '" >';
        	                             }
        	                             html += '</div>';
        	                             return html;
        	                          }
        	           ,buttonIndex:3
        	          },
        	"image": { name:'Image', className:"icon-picture"
        	          ,popupPrompt: 'Image URL'
        	          ,popupButton: 'Insert Image'
        	          ,isURL: true
        	          ,replaceWith:'[img]{input}[/img]'
        	          ,buttonIndex:4
        	         },
        	"link": { name:'Link', className:"icon-link"
        	         ,popupPrompt: 'Link URL'
        	         ,popupButton: 'Insert Link'
        	         ,isURL: true
        	         ,openWith:'[url={input}]'
        	         ,closeWith:'[/url]'                        
        	         ,placeHolder:'Your text to link here...'
        	         ,buttonIndex:5
        	        },
        	"quote": {name:'Quote', className:"icon-quote"
        	         ,popupType: 'search-users'	
					 ,popupPrompt: 'Quoted From'
        	         ,popupButton: 'Insert Quote'
        	         ,openWith:'[quote={input}]'
        	         ,closeWith:'[/quote]'
        	         ,buttonIndex:6
        	        },
        	"code": {name:'Code', className:"icon-code", openWith:'[code]', closeWith:'[/code]', buttonIndex:7},
        	"spoiler": {name:'Spoiler', className:"icon-question"
        	           ,popupPrompt: 'Spoiler Title'
        	           ,popupButton: 'Insert Spoiler'
        	           ,openWith:'[spoiler={input}]'
        	           ,closeWith:'[/spoiler]'
        	           ,buttonIndex:18
        	          },
        	"bold": {name:'Bold', className:"icon-bold", key:'B', openWith:'[b]', closeWith:'[/b]', buttonIndex:9},
        	"italic": {name:'Italic', className:"icon-italic", key:'I', openWith:'[i]', closeWith:'[/i]', buttonIndex:10},
        	"underline": {name:'Underline', className:"icon-underline", key:'U', openWith:'[u]', closeWith:'[/u]', buttonIndex:11},
        	"strikethrough": {name:'Strikethrough', className:"icon-strikethrough", openWith:'[s]', closeWith:'[/s]', buttonIndex:12},
        	"alignleft": {name:'Align Left', className:"icon-align-left",  openWith:'[left]', closeWith:'[/left]', buttonIndex:13},
        	"center": {name:'Align Center', className:"icon-align-center",  openWith:'[center]', closeWith:'[/center]', buttonIndex:14},
        	"alignright": {name:'Align Right', className:"icon-align-right", openWith:'[right]', closeWith:'[/right]', buttonIndex:15},
        	"bullets": {name:'Bulleted list', className:"icon-list-ul",
                         replaceWith:function(markItUp) {
                            var s = markItUp.selection.split( /\r?\n/ );
                            var output = '[list]\n';
                            for ( var i = 0; i < s.length; i++ ) { output += '[*] ' + jQuery.trim(s[i]) + "\n"; } 
                            return output + "[/list]";
                         },     
						 /** 
						  * Offset moves the caret back [n] characters from the end of the string
						  * in this case we move back 8 characters (to the [*] for item entering) 
						  * unless the user marked an existing content, in which case we do nothing
						  * an leave caret at the end of the tag set
						  */						 
						 caretOffset: function( markItUp ) {  
								return ( markItUp.selection == "" ? ($(markItUp.textarea).attr('type') === 'text' ? -10 : -8) : 0 );
							},
                         buttonIndex:16
        	           },
        	"numbering": {name:'Numeric list', className:"icon-list-ol",
                         replaceWith:function(markItUp) { 
                            var s = markItUp.selection.split( /\r?\n/ );
                            var output = '[list=1]\n';
                            for ( var i = 0; i < s.length; i++ ) { output += '[*] ' + jQuery.trim(s[i]) + "\n"; } 
                            return output + "[/list]";
                         },      
						 /** 
						  * Offset moves the caret back [n] characters from the end of the string
						  * in this case we move back 8 characters (to the [*] for item entering) 
						  * unless the user marked an existing content, in which case we do nothing
						  * an leave caret at the end of the tag set
						  */						 
						 caretOffset: function( markItUp ) { 
								return ( markItUp.selection == "" ? ($(markItUp.textarea).attr('type') === 'text' ? -10 : -8) : 0 );
							},
                         buttonIndex:17
                        }, 
        	"indent": {name:'Increase Indent', className:"icon-indent-right", openWith:'[indent] ', closeWith:'[/indent]', buttonIndex:20},
        	"youtube": {name:'YouTube', className:"icon-youtube-play"
           	           ,popupPrompt: 'YouTube Link'
        	           ,popupButton: 'Insert Video'
        	           ,popupValue: function(url) {
									// first take out the params part
									var params = url.split('/').pop().split('?').pop();        
									// may be a multi-part url string, so try to take out
									// a v=xx code, otherwise whole thing is the code
									var code = params.split('&').shift().replace('v=','');		                                           
									if ( code.match(/^[A-Za-z0-9_\-]+$/) ) { return code; }
									return "";
								}
        	           ,openWith:'[youtube]{input}'
        	           ,closeWith:'[/youtube]'
        	           ,buttonIndex:21
        	          },
			"game": {name:'Game BBCode', className:"bbcode-toolbar-game", // Not used atm
				popupContent: function()
				{
					var list = MarkItUp.BBCode.games.split(' ');
					var html = '<div class="games-bbcode">';
					var name = "";

					for(var i in list) {
						switch(list[i]) {
						}
					}

					html += '</div>';
					return html;
				}
				,buttonIndex:1
			},
			"wowitem": {name:'WoW Item', className:"bbwowitem"
					   ,popupType: 'search-wow-item'
					   ,popupClass: 'search-game-item'
					   ,game_id: 14
					   ,popupContent: function(options)       	                          
									  {
										var bonuses = {"none":"None","avoidance":"Avoidance","leech":"Leech","speed":"Speed","indestructible":"Indestructible","warforged":"Warforged","extra-socket":"Extra socket"};
										var levels = {"normal":"Normal","heroic":"Heroic","mythic":"Mythic","raid-finder":"Raid Finder (LFR)","manual":"Manual"};
										
										var level = [];
										var stats = [];
										for ( var n in levels ) {
											level.push('<option value="'+n+'">'+levels[n]+'</option>');
										}
										for ( var n in bonuses ) {
											stats.push('<option value="'+n+'">'+bonuses[n]+'</option>');
										}
										var html = '<div></div>';
										html += '<div><select multiple="multiple" name="level" class="acl-widget" title="Item level (type)" data-placeholderOption="All">'+level.join('')+'</select></div>';
										html += '<div><select multiple="multiple" name="stats" class="acl-widget" title="Tertiary Stats" data-placeholderOption="All">'+stats.join('')+'</select></div>'
										html += '<div class="color"><div class="label">Custom Color</div><div class="button"></div></div>'
										return html;
									  }
           	           ,popupPrompt: 'Search World of Warcraft items'
        	           ,popupButton: 'Insert'
        	           ,openWith:'[wowitem={input}]'
        	           ,closeWith:'[/wowitem]'
        	           ,buttonIndex:22
        	          },
			"riftitem": {name:'Rift Item', className:"bbriftitem"
					   ,popupType: 'search-game-item'
					   ,game_id: 4910
           	           ,popupPrompt: 'Search Rift items'
        	           ,popupButton: 'Insert'
        	           ,popupValue: function(url) {
							return url;
                        }
        	           ,openWith:'[riftitem]{input}'
        	           ,closeWith:'[/riftitem]'
        	           ,buttonIndex:23
        	          },
			"torcom": {name:'TOR Item Search', className:"bbtorcom"
					   ,popupType: 'search-swtor-item'
					   ,popupClass: 'search-game-item'
					   ,game_id: 14
					   ,popupContent: function(options)       	                          
									  {
										var html = '<div></div>';
										return html;
									  }
           	           ,popupPrompt: 'Search SWTOR items'
        	           ,popupButton: 'Insert'
					   ,openWith:'[torcom]{input}'
					   ,closeWith:'[/torcom]'
					   ,buttonIndex:24
			},
			"teratome": {name:'Tera Tome Item', className:"bbteratome"
				,popupType: 'search-game-item'
				,game_id: 4798
				,popupPrompt: 'Tera Tome item name'
				,popupButton: 'Insert'
				,popupValue: function(url) {
					url = jQuery.trim(url);
					return url;
				}
				,openWith:'[teratome]{input}'
				,closeWith:'[/teratome]'
				,buttonIndex:27
			},		
			"d3item": {name:'Diablo 3 Item', className:"bbd3item"
				,popupPrompt: 'Diablo 3 item name'
				,popupButton: 'Insert'
				,popupValue: function(url) {
					url = jQuery.trim(url);
					return url;
				}
				,openWith:'[d3item]{input}'
				,closeWith:'[/d3item]'
				,buttonIndex:26
			},
			"ffxivitem": {name:'FFXIV: A Realm Reborn Item', className:"bbffxivitem"
				,popupType: 'search-game-item'
				,game_id: 69560
				,popupPrompt: 'FFXIV item name'
				,popupButton: 'Insert'
				,popupValue: function(url) {
					url = jQuery.trim(url);
					return url;
				}
				,openWith:'[ffxivarr]{input}'
				,closeWith:'[/ffxivarr]'
				,buttonIndex:38
			},		
			"tesoitem": {name:'The Elder Scrolls Online Item', className:"bbtesoitem"
				,popupType: 'search-game-item'
				,game_id: 69509
				,popupPrompt: 'Elder Scrolls Online item name'
				,popupButton: 'Insert'
				,popupValue: function(url) {
					url = jQuery.trim(url);
					return url;
				}
				,openWith:'[teso]{input}'
				,closeWith:'[/teso]'
				,buttonIndex:39
			},			
			"table": {name:'Table', className:"icon-table"
				,popupPrompt: [ {label:'Rows', cls:'table-inputs rows', name:'rows', attrs:{maxlength:1}}, {label:'Cols', cls:'table-inputs cols', name: 'cols', attrs:{maxlength:1}} ]
				,popupConfig: {labelAlign:'left', labelWidth:50}
				,popupButton: 'Insert Table'
				,popupValue: function(data) { 					
					var table = '';
							
					data.rows = parseInt(data.rows,10);
					data.cols = parseInt(data.cols,10);
					if ( !data.rows ) { data.rows = 2; }
					if ( !data.cols ) { data.cols = 2; }
					
					for ( var r = 0; r < data.rows; r++ )
					{
						table += "[tr]\n";
						for ( var c = 0; c < data.cols; c++ )
						{
							table += (r == 0 && data.rows > 1 ? "[th]Title "+(c+1)+"[/th]" : "[td]Cell "+(r+1)+"-"+(c+1)+"[/td]") + "\n";							
						}
						table += "[/tr]\n";
					}
					
					return table;
				}
				,openWith:'[table]\n{input}'
				,closeWith:'[/table]'
				,buttonIndex:28
			},
            "warning": {
                name: 'Warning', className:"icon-warning-sign",
                openWith: '[warning]', 
                closeWith: '[/warning]',
                buttonIndex: 36
            },
            "noparse": {
                name: 'No parse', className:"icon-square-o",
                openWith: '[noparse]', 
                closeWith: '[/noparse]',
                buttonIndex: 37
            },
            "highlight": {
                name: 'Highlight', className:"icon-square",
                popupContent: function() {
                    var html = '<div class="colors">';
                    var colors = [
                        'eeeeee', 'bebebe', '989898', '7a7a7a', '4e4e4e', '3e3e3e', '282828', '181818',
                        'f3b2b1', 'f3d9b1', 'f3efb1', 'caf3b1', 'b1dcf3', 'b1c6f3', 'ccb1f3', 'eeacf9',
                        'dd2423', 'dd9323', 'ddd123', '6cdd23', '239edd', '2360dd', '6e23dd', 'd113ee',
                        '761413', '764f13', '767013', '3a7613', '135476', '133376', '3b1376', '6f0a7f'
                    ];
                    for ( var i = 0; i < colors.length; i++ ) { 
                        html += '<div data-open="[highlight=#' + colors[i] + ']" data-close="[/highlight]" class="swatch target" style="background: #' + colors[i] + ';" <!-- --></div>'; 
                    }
                    return html + "</div>";
                },
                buttonIndex: 33
            },
            "attach": {
                name: 'Attach File', className:"icon-attach-1",
                beforeInsert: function(){
                    $('.m_forum .element-add-file input[type=file]').trigger('click');
                },
                buttonIndex: 8
            },
            "email": {
                name: 'Email', className:"icon-envelope",
                openWith: '[email=]', 
                closeWith: '[/email]',
                buttonIndex: 30
            },
            "superscript": {
                name: 'Superscript', className:"icon-superscript",
                openWith: '[sup]', 
                closeWith: '[/sup]',
                buttonIndex: 32
            },
            "subscript": {
                name: 'Subscript', className:"icon-subscript",
                openWith: '[sub]', 
                closeWith: '[/sub]',
                buttonIndex: 34
            },
            "justify": {
                name: 'Justify', className:"icon-align-justify",
                openWith: '[justify]', 
                closeWith: '[/justify]',
                buttonIndex: 35
            },
            "line": {
                name: 'Line', className:"icon-minus",
                openWith: '[rule]', 
                buttonIndex: 29
            },
            "columns": {
                name: 'Columns', className:"icon-columns",
                openWith: '[columns]\nColumn text 1\n[nextcol]\nColumn text 2\n[nextcol]\nColumn text 3\n',
                closeWith: '[/columns]',
                buttonIndex: 31
            },
            "twitch": {
                name: 'Twitch', className:"icon-twitch",
                openWith: '[twitch]',
                closeWith: '[/twitch]',
                buttonIndex: 40,
                placeHolder:'Twitch username...'
            }
	    }
}