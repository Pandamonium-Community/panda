
// js file: themes/core/js/system/messaging/enjin.messaging.js

Enjin_Messaging =  {
	options: null,
	transport: null,
	max_retry: 5,
	
	init: function(options) {
		this.options = options;
		
		//@todo check transport
		if (typeof Enjin_Messaging_Pusher != 'undefined') {
			this.transport = Enjin_Messaging_Pusher;
		} else if (typeof Enjin_Messaging_BeaconPush != 'undefined') {
			this.transport = Enjin_Messaging_BeaconPush;
		} else if (typeof Enjin_Messaging_PostMessage != 'undefined') {
			this.transport = Enjin_Messaging_PostMessage;
		} else {
			return; //no transport!
		}
			
		this.transport.init(options);
		$(this.transport).bind('onMessage', function(evt, container) {
			if (!container || !container.data)
				return;
			
			var eval_data = true;
			var message = container.data;
			
			if (container.component) {
				//special javascript handler
				call = 'onModule'
						+Enjin_Core.ucFirst(container.component)
						+Enjin_Core.ucFirst(container.method);
				
				//message.data = eval('('+message.data+')');
				$(Enjin_Messaging).triggerHandler(call, [message]);
			} else if (container.calltype) {			
				//redispatch
				var call = container.calltype.replace(/(-.)/gi, function(str) {
					return str.substr(1).toUpperCase();
				});
				call = 'onMessage'+call.substring(0, 1).toUpperCase()+call.substring(1);
				$(Enjin_Messaging).triggerHandler(call, message);
			}
		});		
	},
	
	getTransport: function() {
		if (this.transport == Enjin_Messaging_BeaconPush) {
			return 'beaconpush';
		} else if (this.transport == Enjin_Messaging_Pusher) {
			return 'pusher';
		} else {
			return 'postmessage';
		}
	},
		
	publishUser: function(namespace, userId, data, callback) {
		this.transport.postUser(namespace, userId, data, callback)
	},
	
	sendUserStatus: function(status) {
		this.transport.postStatus(status);
	},
	
	passRawMessage: function(data) {
		this.transport.passRawMessage(data);
	}
}

;

// js file: themes/core/js/system/messaging/enjin.messaging.pusher.js

Enjin_Messaging_Pusher = {
	domain_msgserver: null,
	options: null,
	iframe: null,
	
	site_id: null,
	channel_user_name: null,
	channel_site_name: null,
	
	channel_user: null,
	channel_site: null,
	channel_site_users: null,
	chatchannels_logged: null, //list of chatchannels logged to avoid double log in
	chatchannels_msgprocessed: null,
	
	init: function(options) {
		this.options = options;
		
		this.channel_site_users = [];
		
		if (!this.chatchannels_logged)
		  this.chatchannels_logged = {};
		
		if (!this.chatchannels_msgprocessed)
		  this.chatchannels_msgprocessed = {};
		
		//generate iframe
		this.loadIframe();
		
		//prepare listener
		var postmessage_fn = function(e) {
			if (e.origin == Enjin_Messaging_Pusher.domain_msgserver) {
				var json = eval('('+e.data+')');
				//var json = e.data;
				
				if (json.calltype == 'error') {
					$(Enjin_Messaging_Pusher).triggerHandler('onError', json);
				} else {
					$(Enjin_Messaging_Pusher).triggerHandler('onMessage', json);
				}
			}
		};
	
		if (window.addEventListener)
			window.addEventListener('message', postmessage_fn, false);
		else
			window.attachEvent('onmessage', postmessage_fn);
		
		if (options.goOnline) {
			setTimeout(function() {
				Enjin_Messaging_Pusher.postStatus(options.goOnline);
			}, 0);
		}		
	},
	
	triggerMessage: function(msg) {
		var wrapper = {
			calltype: msg.namespace,
			data: msg
		};
		$(Enjin_Messaging_Pusher).triggerHandler('onMessage', wrapper);
	},
	
	loadIframe: function() {		
		this.iframe = $('<iframe />');
		this.iframe.hide();
		
		$(document.body).append(this.iframe);

        var self_domain = (window.location.href+'').replace(location.protocol + '//', '');
        self_domain = location.protocol + '//'+self_domain.substr(0, self_domain.indexOf('/'));
		this.domain_msgserver = this.options.crosshtml.substr(0, this.options.crosshtml.indexOf('/', 8));
		
		this.iframe.attr('src', this.options.crosshtml
				+'?userId='+this.options.userId
				+'&siteId='+this.options.siteId
				+'&callback='+escape(self_domain));
		
	},
	
	setToken: function(token) {
		//NOP
	},
	
	postUser: function(namespace, userId, data, callback) {
		var newData = {
				cmd: 'postUser',
				namespace: namespace,
				userId: userId,
				data: data
			};
			$.post('/ajax.php?s=messaging', newData, function(response) {
				if (callback)
					callback.call(Enjin_Messaging_Pusher, response);
			}, 'json');				
	},
	
	postStatus: function(status) {
		var data = {
			cmd: 'postStatus',
			status: status
		};
		$.post('/ajax.php?s=messaging', data, function(response) {
			
		}, 'json');		
	},
	
	passRawMessage: function(data) {
		//@todo pass to child
		var win = this.iframe[0].contentWindow;
		
		var data_json = JSON.stringify(data);
		win.postMessage(data_json, this.domain_msgserver);
	},
	
	prepareUserEvents: function(data) {
		
	},
	
	/* channels part */
	startUserChannel: function() {
		var pusher = Enjin_Pusher.getPusher();
		var channel;
		if (pusher.channel(this.channel_user_name)) {
			channel = pusher.channel(this.channel_user_name);
		} else {
			channel = pusher.subscribe(this.channel_user_name);
		}

		this.channel_user = channel;
		channel.bind('pusher:subscription_succeeded', function(members) {
			//not interested in members as will be itself
			Enjin_Messaging_Tray._preparePusherUserChannel();
		});	
		
		channel.bind('chat_message', function(data) {
			Enjin_Messaging_Pusher.triggerMessage(data);
		});
		
		/* notifications handler */
		channel.bind('enjin-notification', function(data) {
			Enjin_Core.handleBeacon(data);
		});
		
		// bind site if
		if (this.channel_site_name) {
			this.subscribeSitechannel(this.channel_site_name);
		}
	},
	
	subscribeSitechannel: function(channelname) {
		var pusher = Enjin_Pusher.getPusher();
		var channel;
		if (pusher.channel(channelname)) {
			channel = pusher.channel(channelname);
		} else {
			channel = pusher.subscribe(channelname);
		}

		var inactivity_timeouts = {};
		
		channel.bind('pusher_internal:subscription_succeeded', function(data) {
			//get for tray memory
			var ids = [];
			var html = [];
			var i;

			if(data.hasOwnProperty('presence')) {
				for (i = 0; i < data.presence.ids.length; i++) {
					if (data.presence.ids[i] != Enjin_Messaging_Tray.user_id)
						ids.push(data.presence.ids[i]);
				}
			}
			
			Enjin_Messaging_Pusher.channel_site_users = ids;
			
			if (!Enjin_Messaging_Tray.userlist_show_first) {
				if(data.hasOwnProperty('presence')) {
					//user has loaded tray before we have this data, so reuse iternal data
					for (i = 0; i < data.presence.ids.length; i++) {
						var member = data.presence.ids[i];
						member = data.presence.hash[member]; //load html data
						Enjin_Messaging_Tray.pusherSiteJoin(member.site_id, member.html);
					}
				}
			}
			
			// check the message history count, if the locally persisted store has more messages,
			// the for now we do nothing, as the server cache may have been reset; if there are more msgs in
			// server cache, then we may have missd messages, so fetch the server cache and rebuild the local message history
			if ( typeof data.presence.hash[Enjin_Messaging_Tray.user_id].user_chats === 'object' ) {
				var user_chats = data.presence.hash[Enjin_Messaging_Tray.user_id].user_chats;
				for ( var user_id in user_chats ) {
					var chat = typeof Enjin_Messaging_Tray.chats['user_' + user_id] !== 'undefined' ? Enjin_Messaging_Tray.chats['user_' + user_id].container : false;
					if ( chat ) { 
						if ( (user_chats[user_id] && chat.messages_history.length == 0) || (user_chats[user_id] > (new Date(chat.messages_history[chat.messages_history.length-1].time)).getTime()) ) {
							Enjin_Messaging_Pusher.updateChatChannelHistory(user_id);
						}
					} else {
						// there are is no chat persisting for this user, so start a new one
						$.post('/ajax.php?s=messaging',
							   {cmd:'fetch-chat-cache',chat_user_id:user_id}, 
								function(result) {
									if ( result.success ) {									
										for ( var i = 0; i < result.chat_log.length; i++ ) {
											Enjin_Messaging_Tray.onMessageChat(null,result.chat_log[i]);
										}
									}
							}, 'json');
					}
				}
			}
		});	
		
		channel.bind('pusher_internal:member_added', function(member) {
			if (inactivity_timeouts[member.user_id]) {
				clearTimeout(inactivity_timeouts[member.user_id]);
				delete inactivity_timeouts[member.user_id];
			}
			
			var cm = Enjin_Messaging_Pusher.channel_site_users;
			for (var i=0; i<cm.length; i++) {
				if (cm[i] == member.user_id)
					return; //already in site
			}
			
			Enjin_Messaging_Pusher.channel_site_users.push(member.user_id);
			Enjin_Messaging_Tray.pusherSiteJoin(member.user_info.site_id, member.user_info.html);
		});	
		
		channel.bind('pusher_internal:member_removed', function(member) {
			inactivity_timeouts[member.user_id] = setTimeout(function() {			
				var nm = [];
				var cm = Enjin_Messaging_Pusher.channel_site_users;
				for (var i=0; i<cm.length; i++) {
					if (cm[i] == member.user_id)
						continue; //skip this member
					
					nm.push(cm[i]);
				}
				
				Enjin_Messaging_Pusher.channel_site_users = nm;				
				Enjin_Messaging_Tray.pusherSiteLeave(Enjin_Messaging_Pusher.site_id, member.user_id);
			}, 10000);
		});
		
		//listen for events
		channel.bind('chat_message', function(data) {
		    data.namespace = 'site-channel-'+data.namespace;
            Enjin_Messaging_Pusher.triggerMessage(data);
        });			
	},
	
	/**
	 * Internal method used by site subscription success event to resync the persisted chat history
	 * of any 
	 */
	updateChatChannelHistory: function(user_id) {
		var chat = Enjin_Messaging_Tray.chats['user_' + user_id].container;

		// missing some messages from local persistance, so fetch the server log and update the local display and cache
		$.post('/ajax.php?s=messaging',
			   {cmd:'fetch-chat-cache',chat_user_id:user_id}, 
				function(result) {
					if ( result.success ) {
						chat.el_messages.empty();
						chat.messages_history = [];
						for ( var i = 0; i < result.chat_log.length; i++ ) {
							var myself = ( result.chat_log[i].userId != user_id );		// I posted this message if the user is not the target chat user
							chat.addMessageText(myself,result.chat_log[i].data,new Date(result.chat_log[i].timestamp));
						}
					}
			}, 'json');
	},
	
	getPusherChatChannel: function(preset_id) {
		return "presence-pchat"+preset_id;
	},
	
	addChatChannel: function(preset_id, callback, scope) {
	    if (!this.chatchannels_logged)
	       this.chatchannels_logged = {};
	    
	    if (this.chatchannels_logged[preset_id]) {
            if (callback)
                callback.call(scope);
                	        
            return; //no need to add extra
        }
	    	    
		var pusher = Enjin_Pusher.getPusher();
		var channel;
		if (pusher.channel(Enjin_Messaging_Pusher.getPusherChatChannel(preset_id))) {
			channel = pusher.channel(Enjin_Messaging_Pusher.getPusherChatChannel(preset_id));
		} else {
			channel = pusher.subscribe(Enjin_Messaging_Pusher.getPusherChatChannel(preset_id));
		}
		
		this.chatchannels_logged[preset_id] = channel;
		var users_logged = [];
		var inactivity_timeouts = {};
				
		
		channel.bind('pusher:subscription_succeeded', function(members) {
            members.each(function(member) {
                // for example:
                users_logged.push(member);
            });
            
                
            if (callback)
                callback.call(scope);
		});
		
		channel.bind('pusher:subscription_error', function() {
			//apply callback, @todo maybe have an error function
			if (callback)
				callback.call(Enjin_Messaging_Tray);
		});		
	
        channel.bind('pusher:member_added', function(member) {
            var user_id = member.id;
            if (inactivity_timeouts[user_id]) {
                clearTimeout(inactivity_timeouts[user_id]);
                delete inactivity_timeouts[user_id];
            }
            
            var found = false;
            for (var i=0; i<users_logged.length; i++) {
                if (users_logged[i].user_id == user_id) {
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                users_logged.push(member);
                
                Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'onUserAdded', [member.info]);
            }            
        });     
        
        channel.bind('pusher_internal:member_removed', function(member) {
            var user_id = member.user_id;
            inactivity_timeouts[user_id] = setTimeout(function() {
                delete inactivity_timeouts[user_id]; //remove entry
                var nusers_logged = [];
                
                for (var i=0; i<users_logged.length; i++) {
                    if (users_logged[i].id == user_id)
                        continue;
                    
                    nusers_logged.push(users_logged[i]);
                }
                  
                users_logged = nusers_logged;
                                    
                //tell to channel to remove user
                Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'onUserRemoved', [user_id, users_logged.length]);                
            }, 20000);
        });        
		
		channel.bind('chat_message', function(event) {
			var message = event.data;
			
			if (Enjin_Messaging_Pusher.canProcessChatChannelMessage(event.data)) {
			    Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'onChatChannelMessage', [message]);
			} else {			    
                //@todo remove this part as won't be needed later
    			if (event.userId == Enjin_Messaging_Tray.user_id) {
    				if (message.type != 'update-topic'
    					&& message.type != 'banned'
    					&& message.type != 'userstatus'
    					&& message.type != 'history-clear')
    					return; //not publish myself status
    			}
    			
    			Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'onChatChannelMessage', [message]);
    		}
		});
	},
	
	removeChatChannel: function(preset_id) {
	    if (this.chatchannels_logged[preset_id])
	       delete this.chatchannels_logged[preset_id];
	    
		var pusher = Enjin_Pusher.getPusher();
		var channel = Enjin_Messaging_Pusher.getPusherChatChannel(preset_id);
		
		pusher.unsubscribe(channel);
	},
	
	canProcessChatChannelMessage: function(message) {
        if (!this.chatchannels_msgprocessed)
            this.chatchannels_msgprocessed = {};
            
        if (!message.uniqid)
            return;
             
        if (this.chatchannels_msgprocessed[message.uniqid])
            return false;
            
        //we don't have it so process
        this.chatchannels_msgprocessed[message.uniqid] = message.uniqid;
        return true;
	} 
}
;

// js file: themes/core/js/system/messaging/enjin.messaging.tray.container.js

/**
 * Chat text container
 */
Enjin_Messaging_Tray_Container = function(user_id, options) {
	this.init(user_id, options);
}

Enjin_Messaging_Tray_Container.__resizeLimits = {min: 120, max: 1100};

Enjin_Messaging_Tray_Container.prototype =  {
	user_id: null,
	options: null,
	el: null,
	el_messages: null,
	el_topic: null,
	el_text: null,
	el_anchor: null,
	el_separator: null,
	sent_typing: false,
	
	displayname_me: null,
	displayname_other: null,
	messages_history: [],
	disable_persistent_save: false,
	
	init: function(user_id, anchor, options) {
		this.user_id = user_id;
		this.options = options;
		this.el_anchor = anchor;
		this.messages_history = [];
		
		var user = Enjin_Messaging_Tray.getUser(this.user_id);
		if(user !== null && user.hasOwnProperty('displayname')) {
			this.displayname_other = Enjin_Messaging_Tray.cleanDisplaynameLength(user.displayname, 18);
		}
		else {
			this.displayname_other = 'Unknown';
		}
		
		var user = Enjin_Messaging_Tray.getUserMe();
		if(user !== null && user.hasOwnProperty('displayname')) {
			this.displayname_me = Enjin_Messaging_Tray.cleanDisplaynameLength(user.displayname, 18);
		}
		else {
			this.displayname_me = 'Me';
		}
		
		this.createEl();
	},
	
	showRequestWaiting: function() {
		this.hideExtra();
		this.el.find('.contents-requested').show();
	},
	showRequestConfirmation: function(displayname) {
		this.hideExtra();
		this.el.find('.contents-request .username').html(displayname);
		this.el.find('.contents').show();
		this.el.find('.contents .messages').hide();
		this.el.find('.contents-request').show();
	},
	showDeclined: function() {
		this.hideExtra();
		this.el.find('.contents-declined').show();
	},
	showNotAccepting: function() {
		this.hideExtra();
		this.el.find('.contents-not-friends-chat').show();
	},
	
	showPrivateChat: function() {
		this.hideExtra();
		this.el.find('.contents').show();		
		this.el.find('.contents .messages').show();		
		this.el.find('.wrapper .title .notfriend').show();
	},
	hideExtra: function() {
		this.el.find('.contents').hide();
		this.el.find('.contents-declined').hide();
		this.el.find('.contents-request').hide();
		this.el.find('.contents-requested').hide();
		this.el.find('.wrapper .title .notfriend').hide();
	},
	
	showIgnore: function(blocked) {
		var msg = 'User has ignored you. Try later.';
		if (blocked)
			msg = 'User has blocked you. Try later.';
		
		this.el.find('.contents .input-area input[name=input-text]').hide();
		this.el.find('.contents .input-area .declined').text(msg);
		this.el.find('.contents .input-area .declined').show();
		
		//hide status
		this.el_anchor.setStatus('offline');
	},
	
	normalChat: function() {
		return this.el.find('.contents .messages').is(':visible');
	},
	
	updateTopic: function(topic) {
		var topic_clean = Enjin_Messaging_Tray.cleanDisplaynameLength(topic, 25);
		this.el.find('.wrapper .title .topic').html(topic_clean);
	},
	
	createEl: function() {
		var user = Enjin_Messaging_Tray.getUser(this.user_id);
		var container = $('#enjin-tray-chat-container').clone();
		var self = this;
		var _userlink = '/profile/'+this.user_id;
		
		container.removeAttr('id');
		container.find('.wrapper .title .avatar').append('<img src="'+user.avatar+'" />');
		container.find('.wrapper .title .username a').attr('href', _userlink);
		container.find('.wrapper .title .username a').html(this.displayname_other);
		
		container.find('.wrapper .title .minimize').bind('click', function() {
			Enjin_Messaging_Tray.minimizeChatUser(self.user_id);
		});		
		
		if (Enjin_Messaging_Tray.isFriend(this.user_id)) {
			container.find('.wrapper .title .notfriend').hide();
		} else {
			container.find('.wrapper .title .notfriend').bind('click', function() {
				Enjin_Messaging_Tray.showPrivateRequestOptionsPopup(self.user_id);
			});			
		}
		
		this.el_separator = container.find('.wrapper .bottom-separator'); 
		this.el_text = container.find('.wrapper .input-area input[type=text]'); 
		this.el_text.bind('keydown', function(evt) {
			if (evt.keyCode == 0xD) {
				self.sendMessage();
			} else if (evt.keyCode >= 0x20 && evt.keyCode <= 0x7e) {
				//if is ascii code
				if (!self.sent_typing) {
					self.sent_typing = true;
					self.sendTyping();
				}
			}
		});
		container.appendTo(document.body);
		
		this.el = container;
		this.el_messages = container.find('.wrapper .contents .messages');
		this.updateTopic(user.messaging_quote);
		this.hide(true);
		
		if (!Enjin_Messaging_Tray.isFriend(this.user_id)) {
			//bind events to contents
			this.el.find('.contents-request .button-accept a').bind('click', function() {
				Enjin_Messaging_Tray.acceptPrivateRequest(self.user_id);
			});
			this.el.find('.contents-request .button-ignore a').bind('click', function() {
				Enjin_Messaging_Tray.ajaxIgnoreUser(self.user_id);
			});
			this.el.find('.contents-request .button-block a').bind('click', function() {
				Enjin_Messaging_Tray.ajaxBlockUser(self.user_id);
			});
			
		} else {
			//just remove any confirmation area
			this.el.find('.contents-request').remove();
			this.el.find('.contents-requested').remove();
		}
		
		
		/* prepare input for resize */
        this.el.find('.title .resize-anchor').mousedown(function(evt) {
           evt.stopPropagation();
           evt.preventDefault();
           
           self.startResizing(evt);
        });
        /* end of input for resize */       
	},
	
    /* resizing part */
    startResizing: function(evt) {
        var self = this;
        var currentPageY = evt.pageY;
        var currentContainerHeight = this.el.height();
        
        var el_contents = this.el.find('.contents');
        var el_contents_messages = this.el.find('.contents .messages');
        var currentHeight = el_contents.height();
        var currentContentHeight = el_contents_messages.height();
        
        var fn_resize = function(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            
            var offset = (currentPageY - evt.pageY);
            var newContainerHeight = currentContainerHeight + offset;            
            
            if (evt.pageY > 10 
                && newContainerHeight >= Enjin_Messaging_Tray_Container.__resizeLimits.min
                && newContainerHeight <= Enjin_Messaging_Tray_Container.__resizeLimits.max) {                    
                var newHeight = currentHeight + offset;
                var newContentHeight = currentContentHeight + offset;
                    
                //apply new height
                el_contents.css('height', newHeight);
                el_contents_messages.css('height', newContentHeight);                
            }            
        }
        
        $(document).bind('mousemove', fn_resize);
        $(document).bind('mouseup', function(evt) {
            $(document).unbind('mousemove', fn_resize);
            self.persistentSave(); //save height
        });
    },	
	
	sendTyping: function() {
		if (!this.normalChat())
			return;
		
		Enjin_Messaging.publishUser('typing', this.user_id);
	},
	
	sendMessage: function() {
		var text = $.trim(this.el_text.val());
		
		this.el_text.val('');
		if (text != '') {
			var self = this;
			this.sent_typing = false;
			var callback = function(response) {
				self.addMessageText(true, response.message);
			}
			
			if (!this.normalChat())
				Enjin_Messaging_Tray.acceptPrivateRequest(this.user_id, text, callback);	
			else
				Enjin_Messaging.publishUser('chat', this.user_id, text, callback);
			
		}
	},
	
	hide: function(skip_save) {
		this.el.hide();
		this.el_anchor.setSelected(false);
		
		if (!skip_save)
			this.persistentSave();
	},
	
	show: function(offset) {
		//we need to bound to right/bottom
		var right = $(window).width() - offset.left - offset.width;
		this.el.css('right', right);
		this.el.css('bottom', offset.height-1);
		this.el.show();
		this.el_separator.css('width', offset.width-14);
		
		this.el_text.focus();
		//this.el_text.val('');
		this.el_anchor.setSelected(true);
		this.persistentSave();
		this.scrollBottom();
	},
	
	getTime: function(time) {
		var now = new Date();
		
		if (!time)
			time = now;
		
		//check if is after 24 hours
		if (now.getTime() - time.getTime() > 86400000) {
			return time.asString("mmm dd");
		} else {
			//just hour, minute 
			return time.asString("hh:min apm");
		}
		
		
	},
	
	addMessageStatus: function(status, time) {
		this.removeMessageTyping();
		var user = Enjin_Messaging_Tray.getUser(this.user_id);
		var html = '<div class="message message-status status-'+status+'">\
					<div class="time">'+this.getTime(time)+'</div>\
					<span class="container">'+user.displayname+'</span> is '+status+'\
				</div>';
					
		this.el_messages.append(html);
		this.scrollBottom();
		
		this.persistentAddMessage({
			type: 'status', 
			status: status,
			time: time?time:(new Date()).getTime()
		});
	},
	
	addMessageText: function(myself, text, time) {
		this.removeMessageTyping();
		var displayname;
		var classes = ["message", "message-chat"];
		
		if (myself) {
			displayname = this.displayname_me;
			classes.push("message-me");
		}
		else
			displayname = this.displayname_other;
		
		//change to new target
		text = text.replace(/<a href="/g, '<a target="_blank" href="');
		var html = '<div class="'+classes.join(" ")+'">\
	<div class="top">\
		<div class="time">'+this.getTime(time)+'</div>\
		<div class="username">'+displayname+'</div>\
		<div class="clearing"><!--  --></div>\
	</div>\
	<span class="container">\
		'+text+'\
	</span>\
</div>';
	
		this.el_messages.append(html);
		this.scrollBottom();
		
		this.persistentAddMessage({
			type: 'text', 
			myself: myself?1:0, 
			text: text,
			time: time?time:(new Date()).getTime()
		});
	},
	
	removeMessageTyping: function() {
		this.el_messages.find('.message-typing').remove();
	},
	
	addMessageTyping: function(myself, time) {
		//remove previous if needed		
		this.removeMessageTyping();
		var classes = ["message", "message-typing"];
		
		if (myself)
			classes.push("message-me");
				
		var user = Enjin_Messaging_Tray.getUser(this.user_id);
		var html = '<div class="'+classes.join(" ")+'">\
					'+user.displayname+' is typing\
				</div>';
					
		this.el_messages.append(html);	
		this.scrollBottom();
	},
	
	scrollBottom: function() {
		this.el_messages.scrollTop(this.el_messages[0].scrollHeight);
	},
	
	remove: function() {
		this.persistentClear();
		this.el.remove();
		
		// tell the server we have closed this persistent chat so it can flush the cache as well for this user
		$.post('/ajax.php?s=messaging', {cmd:'clear-chat-cache', chat_user_id: this.user_id});
	},
	
	visible: function() {
		return this.el.is(':visible');
	},
	
	
	/* persistent part */	
	persistentInit: function(data) {
		this.disable_persistent_save = true;
		if (data) {						
			if (data.messages && data.messages.length > 0) {
				for (var i=0; i<data.messages.length; i++) {
					var msg = data.messages[i];
					if (msg.type == 'text') {
						this.addMessageText(msg.myself, msg.text, new Date(msg.time));
					} else if (msg.type == 'status') {
						this.addMessageStatus(msg.status, new Date(msg.time));
					}
				}
				
				this.messages_history = data.messages;
			}			
			
			var notification_number = parseInt(data.anchor_number);
			if (!isNaN(notification_number) && notification_number > 0) {
				this.el_anchor.setNotificationNumber(notification_number);
			}
			
			if (typeof data['height'] != 'undefined') {
			   // this.el.show(); //dummy to know real sizes
                var height = parseInt(data.height.replace('px', ''));
				// if no height apply forced height to fix any existing Chrome chat persists or handle wierd random issues later
				if ( height == 0 ) { height = 259; }
                var nheight = height - 45;
                
                this.el.find('.contents').css('height', height);
                this.el.find('.contents .messages').css('height', nheight);
                //this.el.hide();
            }
            
            if (data.visible == '1')
                Enjin_Messaging_Tray.showChatUser(this.user_id);            
		}
		
		this.disable_persistent_save = false;
	},
	
	persistentAddMessage: function(message) {
		this.messages_history.push(message);
		if (this.messages_history.length > 10) {
			this.messages_history.shift();
		}
		
		this.persistentSave();
	},
	
	persistentSave: function() {
		if (this.disable_persistent_save)
			return;
		
		//need to store in simple way for json storing		
		var data = {
			visible: this.el.is(':visible')?1:0,
			messages: this.messages_history,
			anchor_number: this.el_anchor.getNotificationNumber(),
			// store as px string so we can be compatible with originial .css(..) code, but we must use .actual() here
			// otherwise Chrome breaks as jQuery returns 0px height for hidden divs
			height: this.el.find('.contents').actual('height') + 'px'
		}
		
		//send to child
		Enjin_Messaging.passRawMessage({
			calltype: 'traySaveChatHistory',
			hash: Enjin_Messaging_Tray.getChatHashUser(this.user_id),
			data: data
		});		
	},
	
	persistentClear: function() {
		Enjin_Messaging.passRawMessage({
			calltype: 'trayClearChatHistory',
			hash: Enjin_Messaging_Tray.getChatHashUser(this.user_id)
		});
	}
	
}

/**
* Chat text anchor
*/
Enjin_Messaging_Tray_Container_Anchor_Common = function(params) {
	this.init(params);
}

Enjin_Messaging_Tray_Container_Anchor_Common.prototype =  {
	type: null,
	el: null,	
	el_notification: null,
	total_notifications: null,
	minimized: true,
	params: null,
	type: null,
	playing_blinking: null,
	
	init: function(params) {
		this.params = params;
		this.total_notifications = 0;		
	},
	
	clearNotifications: function() {
		this.total_notifications = 0;
		this.el.find('.content').removeClass('have-notification');
		this.el_notification.hide();
	},
	
	addNotification: function() {
		if (this.minimized) {
            if (this.params.type == 'chat-channel')
                this.playBlinkAnimation();

		    
			this.total_notifications++;
			this.el_notification.find('.number').html(this.total_notifications);
			this.el.find('.content').addClass('have-notification');
			this.el_notification.show();
		}
	},
	
	getNotificationNumber: function() {
		return this.total_notifications;
	},
	setNotificationNumber: function(number) {
		if (this.minimized) {
			this.total_notifications = number;
			this.el_notification.find('.number').html(this.total_notifications);
			this.el.find('.content').addClass('have-notification');
			this.el_notification.show();			
		}
		
		Enjin_Messaging_Tray.setNotificationNumber();
	},
	
	isMinimized: function() {
		return this.minimized;
	},
	
	setSelected: function(value) {
		this.minimized = !value;
		this.el.removeClass('selected');
		
		if (value) {
			this.el.addClass('selected');
			this.clearNotifications();
		}
	},
	
	getEl: function() {
		return this.el;
	},
	
	getBounds: function() {
		var offset = this.el.offset();
		//always take the hidden right border as in the calculation
		offset.width = this.el.outerWidth() + 1; 
		
		//mozilla seems to have fractional offset, so reduce to avoid roundings
		if ($.browser.mozilla)
			offset.left = Math.floor(offset.left);  
		
		offset.height = this.el.outerHeight();
		
		return offset;
	},
	
	hide: function() {
		this.el.hide();
	},
	show: function() {
		this.el.show();
	},
		
	remove: function() {
		this.el.remove();
	},
	
	/* blink animation */
	playBlinkAnimation: function() {
        if (this.playing_blinking)
            return; //already playing
        
        this.playing_blinking = true;
        
        var self = this;
        var total = 0;
        var animation_time = 170;
        
        var blinkFunctionOn = function() {
            self.el.find('.content .name').css('visibility', 'visible');
            
            total++;
            if (total < 3)
                setTimeout(blinkFunctionOff, animation_time)
            else
                self.playing_blinking = false;
        }
        var blinkFunctionOff = function() {
            self.el.find('.content .name').css('visibility', 'hidden');
            setTimeout(blinkFunctionOn, animation_time)
        }
        
       blinkFunctionOff(); //start
	}
};


Enjin_Messaging_Tray_Container_Anchor_User = function() {
    //NOP
}

Enjin_Messaging_Tray_Container_Anchor_User.prototype =  { 
    user_id: null,
    el_icon: null,
    
    initExtended: function() {
        this.type = 'user';
        this.initUser(this.params.user_id);        
    },
    
    initUser: function(user_id) {
        this.user_id = user_id;
        this.createElUser();
    },
    
    createElUser: function() {
        var self = this;
        var user = Enjin_Messaging_Tray.getUser(this.user_id);
        var container = $('#enjin-tray-chat-container-anchor').clone();
        
        container.removeAttr('id');     
        container.attr('data-userid', this.user_id);        
        container.find('.content .name').html(Enjin_Messaging_Tray.cleanDisplaynameLength(user.displayname, 16));
        
        this.el_icon = container.find('.content .icon');
        this.el_notification = container.find('.notification');     
        
        container.find('.content > a').bind('click', function(){
            Enjin_Messaging_Tray.toggleChatUser(self.user_id);
        });
        
        container.find('.content .close').bind('click', function(){
            Enjin_Messaging_Tray.closeChatUser(self.user_id);
        });
        
        this.el = container;
        
        this.setStatus(Enjin_Messaging_Tray.getUserStatus(this.user_id));
    },
    
    removeStatus: function() {
        this.el_icon.removeClass('status-online');
        this.el_icon.removeClass('status-away');
        this.el_icon.removeClass('status-offline');
    },
    
    setStatus: function(status) {
        this.removeStatus();
        this.el_icon.addClass('status-'+status);
    }    
}

/* for chat channels */
Enjin_Messaging_Tray_Container_Anchor_ChatChannel = function() {
    //NOP    
}

Enjin_Messaging_Tray_Container_Anchor_ChatChannel.prototype =  { 
    el_channel_count: null,
    
    initExtended: function() {
        this.type = 'chatchannel';
        this.initChatChannel(this.params.preset_id);        
    },
 
    initChatChannel: function(preset_id) {
        this.preset_id = preset_id;
        this.createElChatChannel(preset_id);
    },
    
    createElChatChannel: function(preset_id) {
        var self = this;
        var container = $('#enjin-tray-chat-channel-container-anchor').clone();
        
        container.removeAttr('id');
        container.attr('data-presetid', preset_id);     
        
        this.el_channel_count = container.find('.content .count');
        this.el_notification = container.find('.notification');     
		
		// put in a little notice so user knows it is trying to load...
        container.find('.content .name').text('Loading...');
		
        container.find('.content > a').bind('click', function(){
            self.mode_show_in_tray = false; //allow to close
			container.find('.content .close').show();
            Enjin_Messaging_Tray.toggleChatChannel(self.preset_id);
        });

        container.find('.content .close').bind('click', function(){
            if (self.mode_show_in_tray)
                return; //avoid close

            Enjin_Messaging_Common_ContainerChatChannel_Static.leaveChat(self.preset_id);
        });
        
        this.el = container;
    },  
    
    channelUpdateCount: function(total) {
        if (total > 0)
            this.el.find('.content .count').addClass('alternate');
        else
            this.el.find('.content .count').removeClass('alternate');
            
        this.el.find('.content .count').text(total);
        this.channelUpdatePersistent();
    },
    channelUpdateName: function(name) {
        this.el.find('.content .name').text(Enjin_Messaging_Tray.teaser(name, 16));
        this.channelUpdatePersistent();
    },
	channelHideX: function() {
		this.el.find('.content .close').hide();
	},
    channelUpdatePersistent: function() {
       Enjin_Messaging_Tray.updateChatChannelInfo(this.params.preset_id, 
           this.el.find('.content .name').text(),
           this.el.find('.content .count').text()); 
    }        
}
;

// js file: themes/core/js/system/messaging/enjin.messaging.common.container.chatchannel.js

/* common popups */


Enjin_Messaging_Common_ContainerChatChannel_UserStore = {
    users: null,
    init: function() {
        this.users = {};
    },

    add: function(preset_id, user) {
        this.users[user.user_id] = user;
    },

    remove: function(preset_id, user_id) {
        delete this.users[user.user_id];
    },

    get: function(preset_id, user_id) {
        return this.users[user_id];
    },

	count: function(preset_id) {
		return
	}
}

Enjin_Messaging_Common_ContainerChatChannel_UserStore.init();


Enjin_Messaging_Tray_ContainerChatChannel_UserPopups = function(html_popup) {
    this.init(html_popup);
}

Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance = null;
Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance = function(html_popup) {
    if (!Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance && html_popup) {
        Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance = new Enjin_Messaging_Tray_ContainerChatChannel_UserPopups(html_popup);
    }

    return Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
}

Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.prototype = {
    el_userinfo: null,
    current_user: null,
    el_popup_smileys: null,

    init: function(html_popup) {
        if (html_popup) {
            var self = this;
            this.presets = {};

            $(html_popup).appendTo(document.body);
            this.el_userinfo = $('.chat-container-channel-popups.popup-user-options');
            this.el_userinfo.find('.sheader .close a').bind('click', this.onCloseUserInfo);
            this.el_userinfo.find('.scontent .button input[type=button]').bind('click', this.processUserInfoButtonClick);

            /* smiley popup */
            this.el_popup_smileys = $('.chatchannel-actions-popup.smileys');
            this.el_popup_smileys.find('img').click(function(evt) {
                Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance().onPopupSmileysClicked(evt);
            });
        }
    },

    processUserInfoButtonClick: function(evt) {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var target = evt.currentTarget;
        var clazz = $(target).attr('class');
        clazz = clazz.replace(/(-.)/g, function(v) {
            return v.substr(1).toUpperCase();
        });

        clazz = 'on'+clazz.substr(0, 1).toUpperCase()+clazz.substr(1);

        if (self[clazz]) {
            self.onCloseUserInfo();
            self[clazz].apply();
        }
    },

    onButtonViewProfile: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var userinfo = self.getUserInfoStored();
        window.location.href = '/profile/'+userinfo.user_id;
    },
    onButtonPrivateChat: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var userinfo = self.getUserInfoStored();

        Enjin_Messaging_Tray.startChatChecking(userinfo.user_id);
    },
    onButtonAddFriend: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var userinfo = self.getUserInfoStored();

        //from profile.friends.js
        $.post('/ajax.php?s=friends', {
                op: 'add',
                user_id: userinfo.user_id
            }, function(result) {
                Enjin_Core.alert("Friend request has been sent to user");
            }, 'json');
    },

    onButtonPrivateMsg: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var userinfo = self.getUserInfoStored();

        window.location.href = '/dashboard/messages/compose?type=user&id='+userinfo.user_id;
    },

    onButtonBanUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var userinfo = self.getUserInfoStored();
        var channel_container = Enjin_Messaging_Common_ContainerChatChannel_Static.getFirstInstancePreset(self.current_user.preset_id);
        if (!channel_container)
            return;

        userinfo = $.extend({}, userinfo); //make a copy for passing params
        if (!channel_container.commonSettingsIsBanned(userinfo.user_id))
            userinfo.hideremoveban = true;

        var banned_until = channel_container.commonSettingsBanGetDataUntil(userinfo.user_id);

        Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance().showBanUser(
            self.current_user.preset_id, 'userid', [userinfo.user_id], banned_until, userinfo);
    },

    onButtonKickUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        var userinfo = self.getUserInfoStored();
        userinfo = $.extend({}, userinfo); //make a copy for passing params

        Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance().showKickUser(self.current_user.preset_id, userinfo);
    },

    onButtonClearChats: function() {
        Enjin_Core.showWindowPopup({
            content: 'Clear all chat messages from this user?',
            cls: 'clear_chats_window',
            hideHeader: true,
            button_text: 'Clear',
            noTabs: true,
            validate: false,
            callback: function(){
                var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
                var userinfo = self.getUserInfoStored();

                // remove the messages
                $.get('/ajax.php?s=messagingchat&cmd=messageDelete&preset_id=' + self.current_user.preset_id + '&user_id=' + userinfo.user_id);
                $.fn.chatMessageDeleteUserMessages(userinfo.user_id);

                // hide the popup
                Enjin_Core.hideCustomPopup('.clear_chats_window', true);
            }
        });
    },

    getUserInfoStored: function() {
        return Enjin_Messaging_Common_ContainerChatChannel_UserStore.get(this.current_user.preset_id, this.current_user.user_id);
    },

    showUserInfo: function(preset_id, user_id) {
        
        // go to your profile in a new window
        if (user_id == Enjin_Messaging_Tray.user_id) {            
            window.open('/profile/' + user_id);
            return;
        }            

        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        self.current_user = {preset_id: preset_id, user_id: user_id};
        var userinfo = self.getUserInfoStored();

        if (typeof userinfo === 'undefined') {
            return;
        }

        self.el_userinfo.find('.sheader .displayname').html(userinfo.displayname);

		// only show the Add as Friend button if there is no relation beween us, or if we blocked
		// the other user, still show it to give oppertunity to change to friends
        self.el_userinfo.find('.button-add-friend').hide();
        if (!userinfo.friendship || userinfo.friendship == 'blocked_1') {
			self.el_userinfo.find('.button-add-friend').show();
        }

        if (Enjin_Messaging_Common_ContainerChatChannel_Static.canModerate(preset_id)) {
            self.el_userinfo.find('.button-moderator').show();
        } else {
            self.el_userinfo.find('.button-moderator').hide();
        }

        Enjin_Core.createPopupSeparator();
        Enjin_Core.placeAfterPopupSeparator(self.el_userinfo);
        Enjin_Core.centerPopup(self.el_userinfo);
        self.el_userinfo.show();
    },

    onCloseUserInfo: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.__instance;
        self.el_userinfo.hide();
        Enjin_Core.removePopupSeparator();
    },

    /* for smiley popup */
    togglePopupSmiley: function(evt, el) {
       if (this.el_popup_smileys.is(':visible')) {
           //close
           this.el_popup_smileys.hide();
       } else {
           this.showPopupSmiley(evt, el);
       }
    },

    attachClickOne: function(el, nodeName) {
        var self = this;
        $(document).one('click', function(evt){
            var have_parent = false;
            $(evt.target).parents().each(function() {
                if (this == el[0])
                    have_parent = true;
            });

            if (evt.target.nodeName != nodeName
                && have_parent) {
                self.attachClickOne(el, nodeName);
            } else {
                //outside, so remove
                el.hide();
            }
        });
    },

    showPopupSmiley: function(evt, el) {
        evt.stopPropagation();
        evt.preventDefault();

        var instance = Enjin_Messaging_Common_ContainerChatChannel_Static.getInstanceBelongingEl(el);
        if (!instance)
            return;

        var offset = $(el).offset();
        var left = (offset.left + $(el).width()) - this.el_popup_smileys.width();
        var ptop = offset.top - this.el_popup_smileys.height() - 10;

        this.el_popup_smileys.get(0).instance = instance;
        this.el_popup_smileys.css('left', left+"px");
        this.el_popup_smileys.css('top', ptop+"px");
        this.el_popup_smileys.show();

        this.attachClickOne(Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance().el_popup_smileys, 'IMG')
    },

    onPopupSmileysClicked: function(evt) {
        Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance().el_popup_smileys.hide();

        var data = $(evt.target).attr('data');
        if (data != '') {
            data = Enjin_Core.base64.decode(data);

            var channel = this.el_popup_smileys.get(0).instance;
            if (channel)
                channel._commonInsertAtCaret(" "+data+" ");
        }
    }
}

/* admin popups */
Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups = function(html_popup) {
    this.init(html_popup);
}

Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance = null;
Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance = function(html_popup) {
    if (!Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance && html_popup) {
        Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance = new Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups(html_popup);
    }

    return Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
}

Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.prototype = {
    el_adduser: null,
    el_banuser: null,
    el_kickuser: null,
    presets: null,
    original_adduser_submit_label: null,

    /* moderation */
    el_popup_moderation: null,
    moderation_mute_button: null,

    el_popup_bbcode: null,


    init: function(html_popup) {
        if (html_popup) {
            var self = this;
            this.presets = {};
            $(html_popup).appendTo(document.body);

            this.el_adduser = $('.chat-container-channel-popups.popup-acl-add-user');
            this.el_adduser.find('.sheader .close a').bind('click', this.onCloseAddUser);
            this.el_adduser.find('.scontent .submit-area .orcancel a').bind('click', this.onCloseAddUser);
            this.el_adduser.find('.scontent .submit-area input[type=submit]').bind('click', this.onSubmitAddUser);
            this.original_adduser_submit_label = this.el_adduser.find('.scontent .submit-area input[type=submit]').val();

            //for ban user
            this.el_banuser = $('.chat-container-channel-popups.popup-ban');
            this.el_banuser.find('.sheader .close a').bind('click', this.onCloseBanUser);
            this.el_banuser.find('.scontent .submit-area .orcancel a').bind('click', this.onCloseBanUser);
            this.el_banuser.find('.scontent .submit-area input[type=submit]').bind('click', this.onSubmitBanUser);

            Enjin_Core.bindEnter(this.el_banuser.find('.scontent input[name=reason]'), function() {
                self.onSubmitBanUser();
            });

            //for kick user
            this.el_kickuser = $('.chat-container-channel-popups.popup-kick');
            this.el_kickuser.find('.sheader .close a').bind('click', this.onCloseKickUser);
            this.el_kickuser.find('.scontent .submit-area .orcancel a').bind('click', this.onCloseKickUser);
            this.el_kickuser.find('.scontent .submit-area input[type=submit]').bind('click', this.onSubmitKickUser);

            Enjin_Core.bindEnter(this.el_kickuser.find('.scontent input[name=reason]'), function() {
                self.onSubmitKickUser();
            });

            //"sugar" interaction helpers
            this.el_banuser.find('.field-panel-bantime select').bind('change', function() {
                self.el_banuser.find('input[name=optionban]').removeAttr('checked');
                self.el_banuser.find('input[name=optionban][value=time]').attr('checked', 'checked');
            });

            /* channel moderation */
           this.el_popup_moderation = $('.chatchannel-actions-popup.popup-moderator');
           this.el_popup_moderation.find('.button input[type=button]').bind('click', this.processPopupModerationButtonClick);

           this.moderation_mute_button = ['Mute Channel', 'Unmute Channel'];
        }
    },

    /* add user popup */
    showAddUser: function(instance, preset_id, acl_name) {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.presets['adduser'] = {preset_id: preset_id, acl_name: acl_name, instance: instance};

        self.el_adduser.find('.scontent .field-panel input[name=userid]').val(''); //clear input
        self.el_adduser.find('.scontent .submit-area input[type=submit]').val(self.original_adduser_submit_label);

        Enjin_Core.createPopupSeparator();
        Enjin_Core.placeAfterPopupSeparator(self.el_adduser);
        Enjin_Core.centerPopup(self.el_adduser);
        self.el_adduser.show();
    },

    onSubmitAddUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        var user_id = self.el_adduser.find('.scontent .field-panel input[name=userid]').val();
        user_id = $.trim(user_id);

        if (isNaN(parseInt(user_id))) {
            Enjin_Core.alert("You must provide a user id");
        } else {
            self.el_adduser.find('.scontent .submit-area input[type=submit]').val('Saving...');

            //save
            var preset_id = self.presets['adduser'].preset_id;
            var data = {
                cmd: 'chat-acl-user-check',
                preset_id: preset_id,
                user_id: user_id
            }

            $.post('/ajax.php?s=messagingchat', data, function(response) {
                if (response.error != '') {
                    Enjin_Core.alert(response.error);
                } else {
                    self.presets['adduser'].instance.commonSettingAccessAddUserReal(self.presets['adduser'].acl_name, response.user_id, response.displayname);

                    self.onCloseAddUser(); //close popup
                }
            }, 'json');
        }
    },

    onCloseAddUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.el_adduser.hide();
        Enjin_Core.removePopupSeparator();
    },

    /* ban user */
    showBanUser: function(preset_id, type, users, bantime, extra) {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.presets['banuser'] = {preset_id: preset_id, type: type, users:users};

        //set label
        switch(type) {
            case 'empty':
                self.el_banuser.find('.scontent .submit-area input[type=submit]').val('Ban User!');
                break;
            default:
                self.el_banuser.find('.scontent .submit-area input[type=submit]').val('Save Changes');
                break;
        }

        //set title
        switch(type) {
            case 'userid':
                self.el_banuser.find('.sheader .panel-option-userid .displayname').html(extra.displayname);
                break;
            case 'multiple':
                self.el_banuser.find('.sheader .panel-option-multiple .count').text(users.length);
                break;
        }


        //prepare
        self.el_banuser.find('.panel-option').hide();
        self.el_banuser.find('.panel-option-'+type).show();

        self.el_banuser.find('.panel-option-removeban').hide();
        if (users && extra && !extra.hideremoveban)
            self.el_banuser.find('.panel-option-removeban').show();

        //deselect all
        self.el_banuser.find('input[name=userid]').val('');
        self.el_banuser.find('.scontent .field-panel input[name=reason]').val('');
        self.el_banuser.find('input[name=optionban]').removeAttr('checked');
        self.el_banuser.find('.field-panel-bantime select').val('');

        if (bantime && bantime != '') {
            self.el_banuser.find('input[name=optionban][value=time]').attr('checked', 'checked');
            bantime = bantime.split(",");
            self.el_banuser.find('.field-panel-bantime select[name="minutes"]').val(bantime[0]);
            self.el_banuser.find('.field-panel-bantime select[name="hours"]').val(bantime[1]);
            self.el_banuser.find('.field-panel-bantime select[name="days"]').val(bantime[2]);
            self.el_banuser.find('.field-panel-bantime select[name="months"]').val(bantime[3]);
        } else
            self.el_banuser.find('input[name=optionban][value=permanent]').attr('checked', 'checked');

        Enjin_Core.createPopupSeparator();
        Enjin_Core.placeAfterPopupSeparator(self.el_banuser);
        Enjin_Core.centerPopup(self.el_banuser);
        self.el_banuser.show();
    },

    onSubmitBanUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        var reason = self.el_banuser.find('.scontent .field-panel input[name=reason]').val();
        var user_id = self.el_banuser.find('.scontent .field-panel input[name=userid]').val();
        user_id = $.trim(user_id);
        reason = $.trim(reason);

        var optionban = self.el_banuser.find('.scontent input[name=optionban]:checked').val();
        var fields = {};

        self.el_banuser.find('.scontent .field-panel-bantime .field-entry select').each(function() {
            fields[this.name] = $(this).val();
        });

        var preset_id = self.presets['banuser'].preset_id;
        var errors = [];

        if (!self.presets['banuser'].users
            && isNaN(parseInt(user_id)))
                errors.push("You must provide a user id");

        if (!optionban || optionban == '')
            errors.push("You must select an action");

        if (optionban == 'time'
            && fields['minutes'] == ''
            && fields['hours'] == ''
            && fields['days'] == ''
            && fields['months'] == '')
            errors.push("You must select a time frame for the ban");

        if (errors.length > 0) {
            Enjin_Core.alert(errors.join("<br />"));
        } else {
            //save
            var users = "";
            if (self.presets['banuser'].users)
                users = self.presets['banuser'].users.join(",");

            self.el_adduser.find('.scontent .submit-area input[type=submit]').val('Saving...');

            if (optionban == 'remove') {
                var data = {
                    cmd: 'chat-ban-remove',
                    preset_id: preset_id,
                    user_id: user_id,
                    users: users
                }

                $.post('/ajax.php?s=messagingchat', data, function(response) {
                    if (response.error != '') {
                        Enjin_Core.alert(response.error);
                    } else {
                        for (var i=0; i<response.users.length; i++) {
                            Enjin_Messaging_Tray
                                .getContainerChatChannel(preset_id)
                                .commonSettingBanUserRemove(response.users[i]);
                        }

                        self.onCloseBanUser(); //close popup
                    }
                }, 'json');
            } else {
                var banned_until = "";
                if (optionban == 'time') {
                    banned_until = fields['minutes']+","
                                    +fields['hours']+","
                                    +fields['days']+","
                                    +fields['months'];
                }

                var data = {
                    cmd: 'chat-ban-add-update',
                    preset_id: preset_id,
                    user_id: user_id,
                    banned_until: banned_until,
                    users: users,
                    reason: reason
                }

                $.post('/ajax.php?s=messagingchat', data, function(response) {
                    if (response.error != '') {
                        Enjin_Core.alert(response.error);
                    } else {
                        for (var i=0; i<response.bandata.length; i++) {
                            Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'commonSettingBanUserAdd', [response.bandata[i]]);
                        }

                        self.onCloseBanUser(); //close popup
                    }
                }, 'json');
            }
        }
    },

    onCloseBanUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.el_banuser.hide();
        Enjin_Core.removePopupSeparator();
    },

    /* kick user */
    onCloseKickUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.el_kickuser.hide();
        Enjin_Core.removePopupSeparator();
    },

    showKickUser: function(preset_id, userinfo) {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;

        self.el_kickuser.attr('data-presetid', preset_id);
        self.el_kickuser.attr('data-userid', userinfo.user_id);
        self.el_kickuser.find('.sheader .displayname').html(userinfo.displayname);
        self.el_kickuser.find('.scontent .field-panel input[name=reason]').val('');

        Enjin_Core.createPopupSeparator();
        Enjin_Core.placeAfterPopupSeparator(self.el_kickuser);
        Enjin_Core.centerPopup(self.el_kickuser);
        self.el_kickuser.show();
    },

    onSubmitKickUser: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        var reason = self.el_kickuser.find('.scontent .field-panel input[name=reason]').val();
        var preset_id = self.el_kickuser.attr('data-presetid');
        var user_id = self.el_kickuser.attr('data-userid');
        reason = $.trim(reason);

        var errors = [];
        if (reason == '') errors.push('You must provide a reason')

        if (errors.length > 0) {
            Enjin_Core.alert(errors.join("<br />"));
        } else {
            var data = {
                cmd: 'chat-kick-user',
                preset_id: preset_id,
                user_id: user_id,
                reason: reason
            }

            $.post('/ajax.php?s=messagingchat', data, function(response) {
                if (response.error != '') {
                    Enjin_Core.alert(response.error);
                } else {
                    self.onCloseKickUser(); //close popup

                    if (response.params) {
						var old_scrollHeight = 0;
						if(this.el_messages.length) old_scrollHeight = this.el_messages[0].scrollHeight;
                        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'commonRemoveUserFromList', [user_id, response.params.total]);

                        //add message channel
                        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'commonAppendMessage', [response.params, true]);
                        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'commonScrollBottom', [null, old_scrollHeight]);
                    }
                }
            }, 'json');
        }
    },


    /* popup moderation */
    processPopupModerationButtonClick: function(evt) {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        var target = evt.currentTarget;
        var clazz = $(target).attr('class');
        clazz = clazz.replace(/(-.)/g, function(v) {
            return v.substr(1).toUpperCase();
        });

        clazz = 'onModeration'+clazz.substr(0, 1).toUpperCase()+clazz.substr(1);

        if (self[clazz]) {
            self.onClosePopupModeration();
            self[clazz].apply();
        }
    },

    onClosePopupModeration: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.el_popup_moderation.hide();
        Enjin_Core.removePopupSeparator();
    },

    togglePopupModeration: function(evt, el, preset_id, option_mute) {
        var container_el = this.el_popup_moderation.get(0).current_owner;
        this.el_popup_moderation.get(0).current_owner = el; //set "current owner"

       if (container_el == el && this.el_popup_moderation.is(':visible')) {
           //close
           this.el_popup_moderation.hide();
       } else {
           this.showPopupModeration(evt, el, preset_id, option_mute);
       }
    },

    showPopupModeration: function(evt, el, preset_id, option_mute) {
        evt.stopPropagation();
        evt.preventDefault();

        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        self.el_popup_moderation.attr('data-presetid', preset_id);
        self.el_popup_moderation.find('.button-mute-toggle').val(self.moderation_mute_button[option_mute]);

        self.el_popup_moderation.show();
        var offset = $(el).offset();
        var left = (offset.left + $(el).width()) - self.el_popup_moderation.width();
        var top = offset.top - self.el_popup_moderation.height() - 10;

        self.el_popup_moderation.css('left', left+"px");
        self.el_popup_moderation.css('top', top+"px");

        Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance().attachClickOne(
            self.el_popup_moderation,
            'DIV');
    },

    onModerationButtonClearHistory: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        var preset_id = self.el_popup_moderation.attr('data-presetid');

        if (preset_id != '') {
            var data = {
                cmd: 'moderation-clear-chat-history',
                preset_id: preset_id
            }

            $.post('/ajax.php?s=messagingchat', data, function(response) {
                Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'commonClearChatHistory', [response]);
            });
        }
    },

    onModerationButtonMuteToggle: function() {
        var self = Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.__instance;
        var preset_id = self.el_popup_moderation.attr('data-presetid');

        //check current status
        var container = Enjin_Messaging_Common_ContainerChatChannel_Static.getFirstInstancePreset(preset_id);
        if (!container)
            return; //could happen ?

        var is_muted = container.is_muted;
        is_muted = (is_muted=="1")?"0":"1"; //perform toggle

        if (preset_id != '') {
            var data = {
                cmd: 'moderation-mute',
                preset_id: preset_id,
                option: is_muted
            }

            $.post('/ajax.php?s=messagingchat', data, function(response) {
                Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'commonToggleMutted', [is_muted, response]);
            }, 'json');
        }
    }
}

/*end of common popus */

/**
 *We need to register all the same containers for presets, so system can do any action on each item
 */

Enjin_Messaging_Common_ContainerChatChannel_Static = {
    states: ['Type a message', 'You cannot chat. Channel is currently muted...'],
    __presets: {},
    addInstancePreset: function(instance) {
        var preset_id = instance.preset_id;
        if (typeof this.__presets[preset_id] == 'undefined')
            this.__presets[preset_id] = [];

        //check don't exists
        for (var i=0; i<this.__presets[preset_id].length; i++) {
            if (this.__presets[preset_id][i] == instance)
                return; //nothing to add
        }

        this.__presets[preset_id].push(instance);
    },

    removeInstancePreset: function(instance) {
        var preset_id = instance.preset_id;
        if (typeof this.__presets[preset_id] == 'undefined')
            return; //not found, so doesn't need any processing

        var npresets = [];

        for (var i=0; i<this.__presets[preset_id].length; i++) {
            if (this.__presets[preset_id][i] == instance)
                continue;

            npresets.push(this.__presets[preset_id][i]);
        }

        if (npresets.length == 0) {
            //remove chat channel
            Enjin_Messaging_Pusher.removeChatChannel(preset_id);
        }
        this.__presets[preset_id] = npresets;
    },

    callInstancesPreset: function(preset_id, callback, args, skip) {
        if (typeof this.__presets[preset_id] == 'undefined')
            return; //not found, so doesn't need any processing

        if (!args)
            args = [];

        var copy_iterator = this.__presets[preset_id].slice(0);

        for (var i=0; i<copy_iterator.length; i++) {
            if (skip && skip == copy_iterator[i])
                continue;

            if (!copy_iterator[i].acceptingCalls)
                continue; //not accepting calls

			if ( typeof copy_iterator[i][callback] === 'function' ) {
				copy_iterator[i][callback].apply(copy_iterator[i], args);
			}
        }
    },

    getFirstInstancePreset: function(preset_id) {
        if (typeof this.__presets[preset_id] == 'undefined')
            return null;

        return this.__presets[preset_id][0];
    },

    getInstanceBelongingEl: function(el) {
        var preset_id = $(el).closest('.chat-container-channel').attr('data-channelid');

        if (typeof this.__presets[preset_id] == 'undefined')
            return null;

        for (var i=0; i<this.__presets[preset_id].length; i++) {
           if (this.__presets[preset_id][i].elBelongsToThis(el))
                return this.__presets[preset_id][i];
        }

        return null;
    },

    leaveChat: function(preset_id, extra) {
        //logout and tell interface about it
        var data = {
            cmd: 'chat-channel-remove',
            preset_id: preset_id
        };

		Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'showGhost', ['working', 'Leaving channel...']);
		// I moved this up out of the callback below to allow the channel trays to close responsivly rather than wait
		// until the exit shutdown chatter had comepleted, in theory the response needs to be passed to this method, but
		// so far nothing uses it, so I made this change to improve UI responsiveness (as opposed to appearing as if click was ignored)
        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'hostOnLeaveChat', [{}, extra]);

        $.post('/ajax.php?s=messagingchat', data, function(response) {
            Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(preset_id, 'onUserRemoved', [response.user_id, response.total]);
        }, 'json');
    },

    canModerate: function(preset_id) {
        var instance = this.getFirstInstancePreset(preset_id);

        if (instance)
            return instance.can_moderate;

        return false;
    }
};

Enjin_Messaging_Common_ContainerChatChannel =  {
    last_played_sound: null,

    commonInit: function(preset_id, options) {
        this.preset_id = preset_id;
        this.options = options;
        this.last_played_sound = 0;

        Enjin_Messaging_Common_ContainerChatChannel_Static.addInstancePreset(this);
    },

    commonRemove: function() {
        Enjin_Messaging_Common_ContainerChatChannel_Static.removeInstancePreset(this);
    },

    elBelongsToThis: function(el) {
        if (!this.el)
            return false;

        var container = $(el).closest('.chat-container-channel');
        if (container.get(0) == this.el.get(0))
            return true;

        //check if is only settings
        if (container.hasClass('chat-container-channel-settings')) {
            if (container.get(0).rel_el == this)
                return true;
        }

        return false;
    },

    commonPrepareEl: function() {
        var self = this;
        this.el_text = this.el.find('.content-input input[name=message]');
        this.el_input_hint = this.el.find('.content-input .hint');
        this.el_input_actions = this.el.find('.content-input .panel-actions');

        this.el_messages = this.el.find('.wrapper .content-messages-container');
        this.el_messages_scrollbar = this.el.find('.wrapper .content-messages-scrollbar');
        this.el_users = this.el.find('.wrapper .content-userlist');
        this.el_separator = this.el.find('.wrapper .bottom-separator');

        //new icons
        this.el_actions_smileys = this.el.find('.content-input .panel-actions .smileys');
        this.el_actions_sound = this.el.find('.content-input .panel-actions .sound');
        this.el_actions_sound.click(function() {
            self.commonSetSoundPreference();
        });


        this.el_text.focus(function() {
            if ((self.is_muted || self.user_kicked) && !self.can_moderate) {
                self.el_text.blur();
                return;
            }

            self.el_input_hint.hide();
        });

        this.el_input_hint.click(function() {
            if ((self.is_muted || self.user_kicked) && !self.can_moderate){
                return; //not allow this action
            }

            self.el_input_hint.hide();
            self.el_text.focus();
        });

        this.el_text.blur(function() {
            if ($.trim(self.el_text.val()) == '')
                self.el_input_hint.show();
        });

        Enjin_Core.bindEnter(this.el_text, function() {
            self.commonSendMessage();
            self.commonHidePopupBBCode();
        });

        /* handle of moderation */
        if (this.can_moderate){            //apply binds
            var el_btn_moderate = this.el.find('.content-input .panel-actions .moderate');
            this.el.find('.content-input .panel-actions .moderate').click(function(evt) {
                Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance().togglePopupModeration(evt, el_btn_moderate, self.preset_id, self.is_muted);
            });

           /* this.el.find('.scontent-data.scontent-banned .row.banned-reason').each(function() {
                self.commonSettingsBanUserAddEvents($(this));
            }); */
        }


        this.el.find('textarea[data-maxchars]').each(function() {
            Enjin_Core.limitMaxChars(this, $(this).attr('data-maxchars'));
        });

        this.commonUpdateCount();

        //clone the settings if have it
        var row_template = this.el_settings.find('.scontent-banned .table-data .row-template');
        row_template.removeClass('row-template').addClass('row');

        this.admin_banned_row_template = row_template.clone();
        row_template.remove(); //remove from dom

        if(row_template.length > 0) {
            Enjin_Messaging_Tray.loadFileUploader(function() {
                self.commonInitUploader();
            });
        }

        this.commonUpdateTextHint();

        //add links for previous messages
        this.el_messages.find('.normal-message .data-content a').attr('target', '_blank');

        if (this.user_kicked) {
            setTimeout(function() {
                self.user_kicked = false;
                self.commonUpdateTextHint();
            }, 20000); //remove after 20 seconds
        }

       //prepare bbcode
        Enjin_Messaging_Tray.loadBBCodeScript(function() {
            self.commonInitBBCodePopup();
        });
    },


    /* pusher calls */
    onUserAdded: function(data) {
        this.commonAddUserToList(data); //just pass message
    },

    onUserRemoved: function(user_id, total) {
        this.commonRemoveUserFromList(user_id, total);
    },

    onChatChannelMessage: function(data) {
        var send_message = false;

        if (data.type == 'userstatus') {
            this.commonSetUserStatus(data);
        } else if (data.type == 'message-delete') {
            $.fn.chatMessageDeleteMessage(data.user_id, data.created);
        } else if (data.type == 'message-user-delete') {
            $.fn.chatMessageDeleteUserMessages(data.user_id);
        } else if (data.type == 'history-clear') {
            this.commonClearChatHistory();
        } else if (data.type == 'action-muted') {
            this.commonSetMuted(1);
            this.commonAppendMessage(data);
        } else if (data.type == 'action-unmuted') {
            this.commonSetMuted(0);
            this.commonAppendMessage(data);
        } else {
            send_message = true;
        }

        if (send_message) {
            if ( data.type == 'chat' || data.disable_join_notification !== true ) {
				this.hostAddNotification();
			}
            this.commonAppendMessage(data);
        }
    },

    /* end of pusher calls */
    commonClearChatHistory: function() {
        this.hostClearNotifications();
        this.commonClearMessages();
    },

    commonAddUserToList: function(data) {
        if (this.el_users && this.el_users.find('.item[data-userid='+data.json_user.user_id+']').length == 0) {
            var getHashSort = function(el) {
                return el.attr('data-hash')
                            +el.find('.full-displayname').text().toLowerCase();
            }

            var hash_sort = getHashSort($(data.html_listuser));
            var added = false;

            this.el_users.find('.item').each( function() {
                if (added)
                    return; //already append

                var hash_short_compare = getHashSort($(this));
                if (hash_short_compare > hash_sort) {
                    //we are after this, so add to before this
                    $(this).before(data.html_listuser);
                    added = true;
                }
            });


            //needs to be append at end of the list
            if (!added)
                this.el_users.append(data.html_listuser);
        }
    },

    commonAjaxAppendMessage: function(response) {
		var old_scrollHeight = 0;
		if(this.el_messages && this.el_messages.length) old_scrollHeight = this.el_messages[0].scrollHeight;

        this.commonAppendMessage(response, true);
        this.commonScrollBottom(null, old_scrollHeight);
    },

    commonAppendMessage: function(data, internal) {
        var html = data.html;
        var play_sound = false;

        if (data.type == 'join') {
            html = data.html_join;
            this.total_online = data.total;

            if (this.el) {
                Enjin_Messaging_Tray.isAjaxFriend(data.json_user.user_id, function(is_friend) {
                    data.json_user.is_friend = is_friend;
                    Enjin_Messaging_Common_ContainerChatChannel_UserStore.add(this.preset_id, data.json_user);
                });

                this.commonAddUserToList(data);
                this.commonUpdateCount();
            } else {
                //just update already existing items
                this.hostUpdateCount(data.total);
            }

            if (data.silent == '1')
                html = null;

        } else if (data.type == 'leave') {
            if (data.leave_type != 'user-leave') {
                return; //discard message
            }

            html = data.html_leave;
            this.commonRemoveUserFromList(data.user_id, data.total);
        } else if (data.type == 'update-topic') {
            html = data.html_topic;

            this.commonSetName(data.name,this.preset_id);
            this.commonSetTopic(data.topic);
        } else if (data.type == 'kicked') {
            if (data.user_id == Enjin_Messaging_Tray.user_id) {
                //I'm kicked, so remove this container
                Enjin_Messaging_Common_ContainerChatChannel_Static.leaveChat(this.preset_id, {type: 'kicked'});
                this.hostChannelKicked(data);
                html = null; // no need to add message
            }

            this.commonRemoveUserFromList(data.user_id, data.total);
        } else if (data.type == 'banned') {
            if (data.user_id == Enjin_Messaging_Tray.user_id) {
                //I'm banned, so remove this container
                Enjin_Messaging_Common_ContainerChatChannel_Static.leaveChat(this.preset_id, {type: 'banned'});
                this.hostChannelBanned(data);
                html = null; // no need to add message
            }

            this.commonRemoveUserFromList(data.user_id, data.total);
        } else {
            play_sound = true; //normal message

            //process anchor
            html = $(html);
            html.find('.data-content a').attr('target', '_blank');

            if (data.type == 'action-muted') {
                this.commonSetMuted(1);
            } else if (data.type == 'action-unmuted') {
                this.commonSetMuted(0);
            }
        }

        if (html && this.el_messages) {
            var _sound = (internal !== true) && play_sound && !this.el_actions_sound.hasClass('off');
            this.commonAppendMessageHtml(html, _sound);
        }
    },

    commonSendMessage: function() {
        if (this.muted && !this.can_moderate)
           return; //nothing to do, channel is muted

        var text = $.trim(this.el_text.val());

        this.el_text.val('');
        if (text != '') {
            var self = this;

            var data = {
                cmd: 'chat-channel-post',
                preset_id: this.preset_id,
                message: text
            }
            $.post('/ajax.php?s=messagingchat', data, function(response) {
                if (response.error != '') {
                    Enjin_Core.alert(response.error);
                } else {
                    Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(self.preset_id, 'commonAjaxAppendMessage', [response]);
                }
            }, 'json');
        }
    },

    commonClearMessages: function() {
       this.el_messages.html(''); //clear
    },

    commonAppendMessageHtml: function(html, play_sound) {
        var el = $(html);
        var self = this;

        // get the message data
		var data_message = el.attr('data-message');
        var message = typeof data_message !== 'undefined' ? $.parseJSON(data_message) : {by_moderator: false};

		var old_scrollHeight = 0;
		if(this.el_messages.length) old_scrollHeight = this.el_messages[0].scrollHeight;

        // show the delete button if we have the rights
        if (self.can_moderate /*&& false === message.by_moderator*/) {
            el.find('.message_delete').addClass('show_delete');
        }

        this.el_messages.append(el);
        this.commonScrollBottom(null, old_scrollHeight);

        if (play_sound) {
            //check if has elapsed enough time to play again sound
            var now = (new Date()).getTime();
            if (now - this.last_played_sound >= 300) {

                //play real sound
                Enjin_Messaging_Tray.soundPlayPreset(1); //"default" as we don't have presets
            }

            this.last_played_sound = now;
        }
    },

    commonRemoveUserFromList: function(user_id, total) {
		this.total_online = total;
        if (this.el) {
            this.el_users.find('[data-userid='+user_id+']').remove();
            this.commonUpdateCount();
        } else {
            //just update already existing items
            this.hostUpdateCount(total);
        }
    },

    commonToggleMutted: function(is_muted, response) {
		var old_scrollHeight = 0;
		if(this.el_messages.length) old_scrollHeight = this.el_messages[0].scrollHeight;

		this.commonSetMuted(is_muted); //update, event system will later get a new message
        this.commonAppendMessage(response, true);
        this.commonScrollBottom(null, old_scrollHeight);
    },

    commonSetMuted: function(flag) {
        flag = parseInt(flag);

        this.is_muted = flag;
        this.el.attr('data-muted', flag);

        if (flag) {
            //set channel muted
            this.el.addClass('muted');
        } else {
            //remove mute
            this.el.removeClass('muted');
        }

        this.commonUpdateTextHint();
    },

    commonUpdateTextHint: function() {
        if (!this.can_moderate) {
            var index = this.is_muted;
            if (this.user_kicked)
                index = 1;

            this.el.find('.content-input .hint').html(Enjin_Messaging_Common_ContainerChatChannel_Static.states[index]);
        }
    },

    commonSetSoundPreference: function() {
        var option;

        if (this.el_actions_sound.hasClass('off')) {
            //set to on
            option = 'on';
        } else {
            //set to off
            option = 'off';
        }

        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(this.preset_id, 'commonSetSoundPreferenceInterface', [option]);

        var ajaxdata = {
            cmd: 'set-channel-sound-preference',
            preset_id: this.preset_id,
            option: option
        }

        $.post('/ajax.php?s=messagingchat', ajaxdata, function(response) {}); //do nothing
    },

    commonSetSoundPreferenceInterface: function(option) {
        if (!this.el_actions_sound)
            return;

         if (option == 'on') {
            // set to on
            this.el_actions_sound.removeClass('off fontello-icon-volume-off').addClass('fontello-icon-volume-down').attr('data-minitooltip', 'Disable Sound');
        } else {
            // set to off
            this.el_actions_sound.removeClass('fontello-icon-volume-down').addClass('off fontello-icon-volume-off').attr('data-minitooltip', 'Enable Sound');
        }
    },

    /* bbcode parts */
    commonInitBBCodePopup: function() {
        /* bbcode popup */
        //this.el_popup_bbcode = $('.chatchannel-actions-popup.bbcode-wrapper');

        var bbcode = $.extend(true, {}, MarkItUp.BBCode);
		// get the buttons to show, either from pre-defined config if its a module or from data attributes if a popup
        bbcode.buttons = typeof this.options !== 'undefined' && typeof this.options.bbcode !== 'undefined' ? this.options.bbcode : this.el.attr('data-bbcode');

		// only create a bbcode popup if there are
		if ( bbcode.buttons != '' ) {
			//create container
			/* <div class="container"></div> */
			this.el.find('.wrapper').append('<div class="bbcode-popup element_popup hidden"><div class="inner"><div class="container"></div></div></div>');
			this.el_popup_bbcode = this.el.find('.wrapper .bbcode-popup');

			//allow to close main popup once secondary is selected
			var self = this;
			var hidePopup = function() {
				self.commonHidePopupBBCode();
			};

			bbcode.markupSet.size.afterInsert = hidePopup;
			bbcode.markupSet.color.afterInsert = hidePopup;
			bbcode.markupSet.highlight.afterInsert = hidePopup;
			bbcode.markupSet.link.afterInsert = hidePopup;
			bbcode.markupSet.image.afterInsert = hidePopup;
			bbcode.markupSet.youtube.afterInsert = hidePopup;
			bbcode.markupSet.spoiler.afterInsert = hidePopup;

			this.el_popup_bbcode.find('.container').markItUp(bbcode, {
				textarea: this.el_text[0]
			});
		}
    },

    commonTogglePopupBBCode: function(evt) {
        //check if belongs to this
        if (!this.el)
            return;

       if (this.el_popup_bbcode.is(':visible')) {
           this.commonHidePopupBBCode();
       } else {
           this.commonShowPopupBBCode(evt, this.el);
       }
    },

    commonShowPopupBBCode: function(evt, el) {
        evt.stopPropagation();
        evt.preventDefault();

        var preset_id = $(el).closest('.chat-container-channel').attr('data-channelid');
        //this.el_popup_smileys_preset_id = preset_id;

        var offset = $(el).offset();
        var left = (offset.left + $(el).width()) - this.el_popup_bbcode.width();

        //this.el_popup_bbcode.css('left', left+"px");
        this.el_popup_bbcode.show();
        this.attachClickOneBBCodePopup();
    },

    commonHidePopupBBCode: function() {
        //close
		if ( typeof this.el_popup_bbcode !== 'undefined' ) {
			this.el_popup_bbcode.hide();
		}
    },

    //special function to handle bbcode popup
    attachClickOneBBCodePopup: function() {
        var self = this;
        $(document).one('click', function(evt){
            var have_parent = false;
            var el_textinput = self.el.find('.content-input')[0];

            $(evt.target).parents().each(function() {
                if (this == self.el_popup_bbcode[0]
                    || this == el_textinput)
                    have_parent = true;
            });

            //attach again
            if (have_parent) {
                self.attachClickOneBBCodePopup();
            } else {
                //outside, so remove
                self.commonHidePopupBBCode();
            }
        });
    },

    commonScrollBottom: function(force_scroll, old_scrollHeight) {
        if (this.el_messages_scrollbar && this.el_messages_scrollbar.length) {
            if (false !== force_scroll
				&& (this.el_messages_scrollbar.scrollTop() + this.el_messages_scrollbar.height() + 1 < old_scrollHeight
				&& old_scrollHeight > this.el_messages_scrollbar.height()))
			{
                // don't scroll because we are not at the scrolling bottom
            } else {
                this.el_messages_scrollbar.scrollTop(this.el_messages[0].scrollHeight);
            }
        }
    },

    commonSetName: function(value, preset_id) {
        //just call in batch
        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(this.preset_id, 'commonSetNameDOM', [value, preset_id]);
    },

    commonSetNameDOM: function(value, preset_id) {
        this.hostSetNameDOM(value);

        if (!this.el)
            return;

       /* this.el_settings.find('.sheader .sinfo .title-text').text(value);
        this.el_settings.find('input[name=channel_name]').val(value);*/
        this.el.find('.wrapper-content .header .title .title-text').text(value);
		$('#enjin-tray-chatchannels-data .item-channel[data-presetid='+preset_id+'] .info .channel-name').html(value);
    },

    commonSetTopic: function(value) {
        //just call in batch
        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(this.preset_id, 'commonSetTopicDOM', [value]);
    },

    commonSetTopicDOM: function(value) {
        if (!this.el)
            return;

        this.el.find('.wrapper-content .header .info .topic').text(value);

        if (this.can_moderate) {
            //update also settings
            //this.el_settings.find('.scontent-main textarea[name=channel_topic]').val(value);
        }
    },

    commonUpdateCount: function() {
		// keep the original code and if there is a display of users count the number of users
		// being displayed, otherwise we'll take the counter that is now tracked during add/remove members
		// @note it would be better in future to maintain this data rather than rely on html parsing
		var total = this.total_online;
		/*if ( this.el_users.length ) {
			total = this.el_users.find('.item').length;
		}*/
		this.el.find('.header .info .title .count').text(total);
        this.hostUpdateCount(total);
    },

    /* settings part */
    commonShowSettings: function() {
		var domain = this.el.attr('data-domain');
		window.open(domain+'/admin/editmodule/index/editoraction/index/preset/' + this.preset_id,'chat_settings');
    },

    commonSettingsIsBanned: function(user_id) {
        var el = this.el_settings.find('.scontent-banned .table-data .container-rows .row[data-userid='+user_id+']');
        if (el.length > 0)
            return true;

        return false;
    },

    commonSettingsBanGetDataUntil: function(user_id) {
        var data_until = '';
        var el = this.el_settings.find('.scontent-banned .table-data .container-rows .row[data-userid='+user_id+']');
        if (el.length > 0)
            data_until = el.attr('data-until');

        return data_until;
    },

    commonSetUserStatus: function(data) {
        if (this.el_users) {
            var item = this.el_users.find('[data-userid='+data.user_id+']');

            //this is kind of hack
            if (data.status == 'offline') //invisible, as other real offline will remove from channel
              data.status = 'online'; //force to be online

            Enjin_Messaging_Tray._setItemStatus(item, data.status);
        }
    },


    /* uploader part */
    commonInitUploader: function() {
        var self = this;
        var devnull = document.createElement('div'); //dummy to avoid list of multiple

        var el_link = this.el_settings.find('.scontent-main .avatar-panel .links .upload-container');

        var upload_params = {
            s: 'messagingchat',
            cmd: 'upload',
            preset_id: this.preset_id
        }

        var el_link_html = '<div class="qq-upload-button">'+el_link.html()+'</div>';

        this.uploader = new qq.FileUploader({
            multiple: false, //not implemented also not working with comet
            element: el_link[0],
            dragdrop: false,
            action: '/ajax.php',
            allowedExtensions: ['jpg', 'jpeg', 'png', 'gif'],
            template: el_link_html,
            _listElement: devnull,
            onSubmit: function(id, filename) {
                self.commonStartUploading();
            },
            onProgress: function(id, filename) {

            },
            onComplete: function(id, filename, response) {
                self.completeUploading(response);
            },
            onCancel: function(id, filename) {
                self.commonStopUploading();
            },
            showMessage: function(message) {

            },
            params: upload_params
        });
    },

    commonStopUpload: function() {
        this.uploader._handler.cancelAll();
    },


    commonStartUploading: function() {
        //show the ghost image
        this.el_settings.find('.scontent-main .avatar-panel .image .image-ghost').show();;
    },
    commonStopUploading: function() {
        //hide ghost
        this.el_settings.find('.scontent-main .avatar-panel .image .image-ghost').hide();
    },

    completeUploading: function(response) {
        //check possible error
        this.commonStopUploading();

        if (response.error != '') {
            this.commonStopUpload(); //just in case
            Enjin_Core.showMessagePopup({
                top: 100,
                message: response.error,
                button_continue: 'Ok'
            });
        } else {
            Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(this.preset_id, 'commonSetAvatarImage', [response]);
        }

        Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(this.preset_id, 'commonUpdateUploadButtonStatus', [false]);
    },

    commonSetAvatarImage: function(response) {
        if (!this.el_settings) return;

        this.el_settings.find('.scontent-main .avatar-panel .image img').attr('src', response.avatar); //preview image
        this.el_settings.find('.sheader .avatar img').attr('src', response.avatar); //settings image
        this.el.find('.wrapper-content .header .avatar img').attr('src', response.avatar); //settings image
    },

    commonUpdateUploadButtonStatus: function(upload) {
        if (!this.el_settings) return;

        if (upload) {
            this.el_settings.find('.scontent-main .avatar-panel .links .upload-container').show();
            this.el_settings.find('.scontent-main .avatar-panel .links .remove').hide();
        } else {
            this.el_settings.find('.scontent-main .avatar-panel .links .upload-container').hide();
            this.el_settings.find('.scontent-main .avatar-panel .links .remove').show();
        }
    },

    commonRemoveUpload: function() {
        var self = this;

        var data = {
            cmd: 'remove-upload',
            preset_id: this.preset_id
        }

        $.post('/ajax.php?s=messagingchat', data, function(response) {
            Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(self.preset_id, 'commonSetAvatarImage', [response]);
            Enjin_Messaging_Common_ContainerChatChannel_Static.callInstancesPreset(self.preset_id, 'commonUpdateUploadButtonStatus', [true]);
        }, 'json');
    },

    /* as we aren't using bbcode toolbars do "manually" the caret */
    _commonInsertAtCaret: function(value) {
        var el = this.el_text[0];

        if (document.selection) {
            el.focus();
            sel = document.selection.createRange();
            sel.text = value;
            el.focus();
        }
        else if (el.selectionStart || el.selectionStart == '0') {
            var startPos = el.selectionStart;
            var endPos = el.selectionEnd;
            var scrollTop = el.scrollTop;
            el.value = el.value.substring(0, startPos)+value+el.value.substring(endPos,el.value.length);
            el.focus();
            el.selectionStart = startPos + value.length;
            el.selectionEnd = startPos + value.length;
            el.scrollTop = scrollTop;
        } else {
            el.value += value;
            el.focus();
        }
    }
};

// js file: themes/core/js/system/messaging/enjin.messaging.tray.container.chatchannel.js

/**
 * Chat text container
 */

Enjin_Messaging_Tray_ContainerChatChannel = function(preset_id, options) {
	this.init(preset_id, options);
}

Enjin_Messaging_Tray_ContainerChatChannel.__states = ['Type a message', 'You cannot chat. Channel is currently muted...'];
Enjin_Messaging_Tray_ContainerChatChannel.__resizeLimits = {min: 120, max: 1100};

Enjin_Messaging_Tray_ContainerChatChannel.prototype =  {
	preset_id: null,
	options: null,	
	el: null,
	el_text: null,
	el_anchor: null,
	el_messages: null,
	el_messages_scrollbar: null,
	el_users: null,
	el_separator: null,
	loading: null,
	
	/*actions*/
	el_actions_smileys: null,
    el_actions_sound: null,
	
	uploader: null,
	
	disable_persistent_save: null,
	admin_acls_access: null,
	admin_banned_row_template: null,	
	
	can_moderate: null,
	is_muted: null,
	user_kicked: null,
	acceptingCalls: false,
		
	init: function(preset_id, anchor, options) {
	    this.commonInit(preset_id, options)	    
		this.el_anchor = anchor;
		this.acceptingCalls = true;				
	},
	
	hostGetType: function(){
	    return 'tray';
	},

	loadEl: function(callback, hide) {
		if (this.loading)
			return; //not double

		if (this.el) {
			//already loaded
			callback.apply();
		}
		
		this.loading = true;		
		var data = {
			cmd: 'chat-channel-join',
			preset_id: this.preset_id
		}
		
		var self = this;
		$.post('/ajax.php?s=messagingchat', data, function(response) {
			if (response.error && response.error != '') {
			    Enjin_Messaging_Common_ContainerChatChannel_Static.leaveChat(self.preset_id);
			    
				if (response.banned_popup) {
					//Enjin_Core.Notifications.addGrowl("growl-chat-channel-banned", response.banned_popup);
				} else {
					//Enjin_Core.alert(response.error); //disabled per request of ENJINCMS-4401
				}
				
				self.el = null; //just allow to call gain
				self.loading = false;
			} else {						    
		        self.is_muted = parseInt(response.is_muted);
		        self.user_kicked = response.user_kicked;   
		        self.can_moderate = response.can_moderate;             
				
				this.total_online = response.count;
				for (var i=0; i<response.json_users.length; i++) {
					Enjin_Messaging_Common_ContainerChatChannel_UserStore.add(self.preset_id, response.json_users[i]);
				}
				
				$(response.html).appendTo(document.body);
				
				if (response.html_popup != '')
					Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance(response.html_popup); //prepare instance
					
				if (response.html_userpopup != '')
					Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance(response.html_userpopup); //prepare instance
					
				
				self.el = $('.chat-container-channel.container-float[data-channelid='+self.preset_id+']');
				self.el_settings = self.el.find('.wrapper-settings');			
				self.loading = false;
				self.el_anchor.channelUpdateName(response.name);
				self.el_anchor.channelUpdateCount(response.count);
				self.commonPrepareEl();
				self.prepareEl(); //internal working
				
				callback.apply();
								
				//prepare main item
				Enjin_Messaging_Tray.setOffsetActive();
				
                //tell to any module instances to load information
                if (typeof Enjin_Messaging_Site_Container != 'undefined')
                    Enjin_Messaging_Site_Container.joinedTrayChat(self.preset_id);
                
                // buttons
                self.el.chatMessageButtons();
                
                // pagination
                self.el.find('.content-messages-scrollbar').chatMessagePagination();
			}
		}, 'json');
	},
		
	prepareEl: function() {
	    var self = this;
	    
		/* prepare input for resize */
		this.el.find('.header .resize-anchor').mousedown(function(evt) {
		   evt.stopPropagation();
		   evt.preventDefault();
		   
		   self.startResizing(evt);
		});
		/* end of input for resize */
		
        this.el.find('.wrapper .header .minimize').bind('click', function() {
            self.hide();
        });
	},
	
	hostUpdateCount: function(total) {
        this.el_anchor.channelUpdateCount(total);
        
        Enjin_Messaging_Tray_Chatchannel.chatChannelUpdateCount(this.preset_id, total);     
    },
	
    hostSetNameDOM: function(value) {
        this.el_anchor.channelUpdateName(value);
    },	
	
	/* resizing part */
	startResizing: function(evt) {
	    var self = this;
	    var currentPageY = evt.pageY;
	    var currentContainerHeight = this.el.height();
	    var currentHeight = this.el.find('.content').height();
	    var currentContentHeight = this.el.find('.content .content-messages').height();
	    
        var fn_resize = function(evt) {
            evt.stopPropagation();
            evt.preventDefault();
            
            var offset = (currentPageY - evt.pageY);
            var newContainerHeight = currentContainerHeight + offset;            
            
            if (evt.pageY > 10 
                && newContainerHeight >= Enjin_Messaging_Tray_ContainerChatChannel.__resizeLimits.min
                && newContainerHeight <= Enjin_Messaging_Tray_ContainerChatChannel.__resizeLimits.max) {                    
                var newHeight = currentHeight + offset;
                var newContentHeight = currentContentHeight + offset;
                    
                //apply new height
                self.el.find('.content').css('height', newHeight);
                self.el.find('.content .content-messages').css('height', newContentHeight);
            }            
        }
	    
        $(document).bind('mousemove', fn_resize);
        $(document).bind('mouseup', function(evt) {
            $(document).unbind('mousemove', fn_resize);            
            self.commonScrollBottom(); //scroll to bottom
            self.persistentSave(); //save height
        });
	},
	
	updateSettingsHeight: function() {
	    if (this.can_moderate) {
	        //adjust settings
	        this.el.find('.wrapper-settings > .scontent').css('height', this.el.find('.wrapper-content').height() - this.el.find('.wrapper-settings > .sheader').height());
	    }
	},
	
    hostOnLeaveChat: function(response) {        
		this.commonRemove();
        Enjin_Messaging_Tray.closeChatChannel(this.preset_id);          
    },	
	
	hostAddNotification: function() {
	   this.el_anchor.addNotification();
    },
    
    hostClearNotifications: function() {
        this.el_anchor.clearNotifications();
        this.persistentSave();
    },
    
    hostChannelBanned: function(data) {
        //add growl
        //Enjin_Core.Notifications.addGrowl("growl-chat-channel-banned", data.html_user_popup);        
    },
    
    hostChannelKicked: function(data) {
        //Enjin_Core.Notifications.addGrowl("growl-chat-channel-kicked", data.html_user_popup);
    },
		
	hide: function(skip_save) {
		if (this.el) {
			this.el.hide();
		}
		
		this.el_anchor.setSelected(false);
		
		if (!skip_save)
			this.persistentSave();
	},
	
	show: function(offset) {
		if (!this.el) {
			//load the html
			var self = this;
			this.loadEl(function() {
				self._show(offset);
			});
		} else {
			this._show(offset);
		}
		
	},
	
	_show: function(offset) {
	    if (offset.width < 10)
	       return; //ghost showing, wait for more information 
	       	    
		//we need to bound to right/bottom
		//first try to set on middle
		var middle = offset.left + (offset.width * 0.5);
		var where = this.el_anchor.el.offset().left - 1;

		if (where < 0) {
			//space is not enough, so use a fallback at right
			where = 14;
		}		
		
		this.el.css('left', where);
		this.el.css('bottom', offset.height-1);
		this.el.show();
		
		var separator_width = 114;
		var separator_left = (middle - separator_width*0.5) - where - 2;
		
		this.el_separator.css('width', separator_width);
		this.el_separator.css('left', separator_left);
		
		//this.el_text.val(''); //not show due bug @4477
		this.el_anchor.setSelected(true);
		this.persistentSave();
		this.commonScrollBottom();
	},
		
	remove: function() {
	    //remove from static
	    this.commonRemove();
	    
		this.persistentClear();
		if (this.el) {
			this.el.remove();
			this.el = false;
		}	
	},
	
	visible: function() {
		if (this.el)
			return this.el.is(':visible');
		
		return false;
	},
		
	/* settings part */
	hostShowSettings: function() {
	   this.updateSettingsHeight(); //force to update as elements hidden don't have height
    },
    
    hostCloseSettings: function() {
        this.el.find('.wrapper-settings').hide();
    },
			
	/* persistent part */	
	persistentInit: function(data) {
		this.disable_persistent_save = true;
		if (data) {
			if (data.visible == '1') {
				var preset_id = this.preset_id;
				var self = this;
				this.loadEl(function() {
					//change size
					Enjin_Messaging_Tray.showChatChannel(preset_id);
					
                    if (typeof data['height'] != 'undefined') {
                        var height = parseInt(data.height.replace('px', ''));
                        var nheight = height - self.el.find('.content .content-input').height();
                        
                        self.el.find('.content').css('height', height);
                        self.el.find('.content .content-messages').css('height', nheight); 
                    }
				}, true);
			}
						
			var notification_number = parseInt(data.anchor_number);
			if (!isNaN(notification_number) && notification_number > 0) {
				this.el_anchor.setNotificationNumber(notification_number);
			}			
		}
		
		this.disable_persistent_save = false;
	},
	
	persistentSave: function() {
		if (!this.el)
			return; //haven't loaded the item
		
		if (this.disable_persistent_save)
			return;
		
		//need to store in simple way for json storing		
		var data = {
			visible: this.el.is(':visible')?1:0,
			anchor_number: this.el_anchor.getNotificationNumber(),
			// store as px string so we can be compatible with originial .css(..) code, but we must use .actual() here
			// otherwise Chrome breaks as jQuery returns 0px height for hidden divs
			height: this.el.find('.content').actual('height') + 'px'
		};
		
		//send to child
		Enjin_Messaging.passRawMessage({
			calltype: 'traySaveChatChannel',
			hash: Enjin_Messaging_Tray.getChatHashChannel(this.preset_id),
			data: data
		});		
	},
	
	persistentClear: function() {
		Enjin_Messaging.passRawMessage({
			calltype: 'trayClearChatChannel',
			hash: Enjin_Messaging_Tray.getChatHashChannel(this.preset_id)
		});
	}	
}

//create a new type of common and extend this with those methods
$.extend(Enjin_Messaging_Tray_ContainerChatChannel.prototype, Enjin_Messaging_Common_ContainerChatChannel);

;

// js file: themes/core/js/system/messaging/enjin.messaging.tray.section.js

/**
 * Tray section list
 */
Enjin_Messaging_Tray_Section = function(type, hash, container, count_offline) {
	this.init(type, hash, container, count_offline);
	this.unloading = false;
}

Enjin_Messaging_Tray_Section.prototype =  {
	type: null,
	el: null,
	el_header: null,
	el_count: null,
	el_arrow: null,
	el_contents: null,
	el_nocontents_message: null,
	count_offline: null,
	
	init: function(type, hash, container, count_offline) {
		this.type = type;		
		this.el = container;
		
		this.count_offline = false;
		if (count_offline)
			this.count_offline = true;
		
		//select els
		this.el_header = container.find('.section-header');
		this.el_count = container.find('.section-header .count');
		this.el_arrow = container.find('.section-header .arrow-container');
		this.el_contents = container.find('.section-contents');
		this.el_nocontents_message = container.find('.section-contents .no-contents');
		var state = {expanded: this.el_arrow.hasClass('expanded')};

		
		//prepare events
		var self = this;
		// this is a HACK for FF, in same instances when navigating away from a page, FF is remaximizing chat windows from the tray,
		// it seems to be executing the click handler below for some reason, so when we start navigating we just flag that it must
		// ignore the handler, this seems to resolve the issue
		window.onbeforeunload = function() { self.unloading = true; };
		this.el_header.bind('click', function() { if ( this.unloading ) { return; }
			if (self.el_arrow.hasClass('expanded')) {
				return;
			} else {
				self.expand();
			}
		});
		
		//set state
		this.updateFromState(state);
		this.updateCount();
	},
	
	updateFromState: function(state) {
		if (state) {
			if (state.expanded) {
				this.expand();
			} else {
				this.shrink();
			}
		}
	},
	
	isExpanded: function() {
		return this.el_arrow.hasClass('expanded');
	},
	
	expand: function() {
		//open
		$('#enjin-tray-messaging .wrapper-container .user-list .user-list-items .section').removeClass('opened');
		$('#enjin-tray-messaging .wrapper-container .user-list .user-list-items .section .section-header .arrow-container').removeClass('expanded');
		$('#enjin-tray-messaging .wrapper-container .user-list .user-list-items .section .section-contents').hide();
		this.el.addClass('opened');
		this.el_arrow.addClass('expanded');
		this.el_contents.show();
	},
	shrink: function() {
		//minimize
		this.el_arrow.removeClass('expanded');
		this.el_contents.hide();			
	},
	
	setCount: function(total) {
		this.el_count.html(total);
		
		//show message
		if (total == 0)
			this.el_nocontents_message.show();
		else 
			this.el_nocontents_message.hide();
	},
	
	updateCount: function() {
		var total;
		if (this.count_offline)
			total = this.el.find('.section-contents .item').length
		else
			total = this.el.find('.section-contents .item').length - this.el.find('.section-contents .item .status-offline').length;
		
		this.el_count.html(total);
		this.el.find('.section-contents .no-filter-data').hide(); //hide filter if have it, since will reset if needed
		
		//show message
		if (total == 0)
			this.el_nocontents_message.show();
		else 
			this.el_nocontents_message.hide();
	}, 
	
	filterSearch: function (query) {
		var found = false;
		this.el.find('.section-contents .no-contents').hide();
		this.el.find('.section-contents .no-filter-data').hide();
		this.el.find('.section-contents .item').each(function() {
			 var name = Enjin_Core.html_entity_decode($(this).find('.displayname').text()); 
			 name = name.toLowerCase();
			 name = name.replace(/ +/, ' ');
			 
			 if (name.indexOf(query) == -1) {
				 $(this).hide();
			 } else if ($(this).find('.icon').hasClass('status-offline')) {
				 $(this).hide();
			 } else { 
				 $(this).show();
				 found = true;
			 }
		});
		
		if (!found)
			this.el.find('.section-contents .no-filter-data').show();
		
		this.updateCount();
	},
	
	filterReset: function() {
		this.el.find('.section-contents .item').show();
		//hide offline
		this.el.find('.section-contents .item').has('.icon.status-offline').hide();
		this.el.find('.section-contents .no-filter-data').hide();
		
		this.updateCount();
	}
}
;

// js file: themes/core/js/system/messaging/enjin.messaging.tray.sectionlist.js

/**
 * Tray section list
 */
Enjin_Messaging_Tray_Sectionlist = function(site_id, el) {
	this.init(site_id, el);
}

Enjin_Messaging_Tray_Sectionlist.prototype =  {
	site_id: null,
	el: null,
	el_section: null, 
	site: null,
	rendered_users: null,
	
	init: function(site_id, el) {
		this.el = el;
		this.site_id = site_id;
		this.el_section = new Enjin_Messaging_Tray_Section('site', "site_"+site_id, el);
	},
	
	joinUser: function(html) {
		var items = this.el.find('.item');
		var found = false;
		var el_inmemory = $(document.createElement('div')).html(html);
		
		//just append to html
		var dataname = el_inmemory.find('.item').attr('data-name');
		var userid = el_inmemory.find('.item').attr('data-userid');
		
		//check if we already have it
		if (this.el.find('.item[data-userid='+userid+']').length == 0) {		
			jQuery.each(items, function() {
				if (!found) {
					var dname = $(this).attr('data-name');
					if (dname.localeCompare(dataname) > 0) {
						//our string is greater so insert before this
						$(html).insertBefore($(this));
						found = true;
					}
				}
			});
				
			if (!found) //just append
				this.el.find('.section-contents').append(html);		
			
			this.el_section.updateCount();
		}
	},
	
	removeUser: function(user_id) {
		this.el.find('.section-contents .item[data-userid='+user_id+']').remove();
		this.el_section.updateCount();
	},
	
	updateStatus: function(user_id, status) {
		var el = this.el.find('.section-contents .item[data-userid='+user_id+']');
		if (el.length > 0) {
			Enjin_Messaging_Tray._setItemStatus(el, status, true);
			this.el_section.updateCount();
			
			return true;
		}
		
		return false;
	},
	
	getSection: function() {
		return this.el_section;
	},
	
	updateCount: function() {
		this.el_section.updateCount();
	}
}
;

// js file: themes/core/js/system/messaging/enjin.messaging.tray.chatchannel.js

/* tray for chatchannels */

Enjin_Messaging_Tray_Chatchannel = {
    el_listfavorites: null,
    el_list_channels: null,
    el_tray: null,
    el_anchor: null,
    loaded: null,
    interval_poll_tray_active: null,
    
    init: function() {
        this.loaded = false;
        this.el_anchor_parent = $('#enjin-tray-chatchannels .main-anchor');
        this.el_anchor = $('#enjin-tray-chatchannels .main-anchor .wrapper');  
        
        //prepare for some chat channel messages
        $(Enjin_Messaging).bind('onMessageSystemChatChannelAcl', this.onMessageAcl);
        
        this.initPollTrayActive();        
    },
    
    initPollTrayActive: function() {   
        var self = this;    
        this.interval_poll_tray_active = setInterval(function() {
            var ajaxdata = {
                cmd: 'polling-active-tray'
            }
            $.post('/ajax.php?s=messagingchat', ajaxdata, function(response) {
                if (response.error == '') {
                    self.setTrayActive(response.have_online);                    
                }
            }, 'json');
        }, 600000); //poll each 5 minutes
    },
    
    /* handle action */
   setTrayActive: function(have_online) {
       this.el_anchor_parent.removeClass('inactive');
        if (!have_online)
            this.el_anchor_parent.addClass('inactive');
   },
    
    /* handling of messages */
   onMessageAcl: function(evt, message) {
       if (message.data.type == 'acl-add') {
           if (message.data.access == 'moderate') {
               //if container exists, then just append message
               var channel = Enjin_Messaging_Tray.getChatChannel(message.data.preset_id);
               if (channel && channel.container) {
                   channel.container.appendMessageHtml(message.data.html_rendered, true);
               }
           }
       }
   },
    
    clickedAnchor: function() {
        if (this.el_tray && this.el_tray.is(":visible")) 
            this.hideList();
        else
            this.showList();
    },
    
    hideList: function() {
        if (this.el_tray)
            this.el_tray.hide();
            
        $('#enjin-tray-chatchannels').removeClass('active');
    },
    showList: function() {
        if (!this.loaded) {
            this.loadList();
        } else {
            this.el_tray.show(250);
        }
        
        $('#enjin-tray-chatchannels').addClass('active');
    },
    
    loadList: function() {
        //@todo load through ajax
        var self = this;
        
        var ajaxdata = {
            cmd: 'load-chatchannel-tray',
            site_id: Enjin_Messaging_Tray.site_id
        }
        
        $.post('/ajax.php?s=messagingchat', ajaxdata, function(response) {
            self.setTrayActive(response.tray_active);
            $(document.body).append(response.html); //add new data to body
                       
            self.loaded = true; 
            self.el_tray = $('#enjin-tray-chatchannels-data');
            self.el_tray.show();
            
            self.el_listfavorites = $('#enjin-tray-chatchannels-data .scontent-favorites');
            self.el_list_channels = $('#enjin-tray-chatchannels-data .scontent-main');
        }, 'json');
    },
    
    
    showMenuTab: function(tab) {
        this.el_tray.find('.scontent-container .scontent-data').hide();
        this.el_tray.find('.scontent-container .scontent-'+tab).show();
        
        this.el_tray.find('.menu-top .tab').removeClass('selected');
        this.el_tray.find('.menu-top .tab[data-type='+tab+']').addClass('selected');        
    },
    
    toggleFavorite: function(preset_id) {
        var el_favorite = this.el_listfavorites.find('[data-presetid='+preset_id+']');
        if (el_favorite.length > 0) {
            //is on favorites, so remove
            el_favorite.remove(); //remove from favorites
            
            var el_main = this.el_list_channels.find('[data-presetid='+preset_id+']');
            el_main.find('.favorite').removeClass('selected');
            
            var ajaxdata = {
                cmd: 'tray-favorite-remove',
                preset_id: preset_id
            }            
            $.post('/ajax.php?s=messagingchat', ajaxdata, function(response) {});
        } else {
            //not favorite so add            
            var el_main = this.el_list_channels.find('[data-presetid='+preset_id+']');
            el_main.find('.favorite').addClass('selected');
            
            var newel = el_main.clone();
            
            //find where should be
            var base_name =  el_main.find('.channel-name').text().toLowerCase();
            var last = null;
            var found = false;
            var list_favorites = this.el_listfavorites;
            
            this.el_listfavorites.find('.item-channel').each(function(index, item) {                
                if (found)
                    return;
                                      
                item = $(item);
                
                var name = item.find('.channel-name').text().toLowerCase();
                if (base_name < name) {
                    if (last == null) //prepend
                        list_favorites.prepend(newel)
                    else
                        last.after(newel);
                        
                    found = true;
                    return;
                }
                
                last = item;
            });

			if (!found) //apennd
				list_favorites.append(newel);

			var ajaxdata = {
				cmd: 'tray-favorite-add',
				preset_id: preset_id
			};
            $.post('/ajax.php?s=messagingchat', ajaxdata, function(response) {});
        }
    },
    
    chatChannelUpdateCount: function(preset_id, count) {
        $('#enjin-tray-chatchannels-data .channel.item[data-presetid='+preset_id+'] .user-count a').text(count);
        $('#enjin-tray-chatchannels .anchor-chat-channel[data-presetid='+preset_id+'] .count').text(count);
        
    }
};
;

// js file: themes/core/js/system/messaging/enjin.messaging.tray.js

Enjin_Messaging_Tray =  {
	user_id: null,
	el_chat_status: null,
	el_chat_status_minimal: null,
	el_chat_status_normal: null,
	el_chat_userlist: null,
	el_chat_anchor: null,
	el_chatchannel_anchor: null,
	el_anchor_number: null,
	el_anchor_number_mini: null,
	el_minimized_notification: null,
	section_friend: null,
    section_favfriend: null,
	
	el_filter_panel: null,
	el_section_friend: null,	
	el_section_favfriend: null,
	
	chats: {},
	friends: {},
	ajaxFriends: {},
	users: {},
	myself_status: 'online',
	myself_status_away: null,
	open_windows: {},
	el_active: null,
	
	tray_mode: 'minimized',
	private_requests: {},		
	
	show_popup: null,
	show_popup_userid: null,
	persistence: null,
	persistent_chats: null, //this will be set by child
	persistent_chat_history: null, //this will be set by child

	/* sounds part */
	sounds: null,
	sound_preset: 0,
	
	quote: null,
	anchor_index: null,
	anchor_chatchannels_index: null,
	
	sections: null,
	sections_ingame: null,
	sections_states: null,
	sections_states_saved: null,
	sections_states_searching: null,
	sections_states_searching_queue: null,
	default_sections: null, //default sections like online
	
	persistent_sectionstates: null,
	userlist_show_first: null,
	site_id: null,
	
	label_chat: 'Click to chat',
	label_channels: 'Click to Join',
	label_ingame: 'Click for info',
	loading_scripts: {},
	
	init: function(user_id) {
		this.userlist_show_first = true;
		this.persistent_chats = {};
		this.sections = {};
		this.sections_ingame = {};
		this.persistent_sectionstates = {};
		
		//set width
		//$('#enjin-tray-messaging .wrapper-container .user-list .user-list-items').width($('#enjin-tray-messaging .user-list').actual('width')-2);
	
        this.ajaxFriends = {};
		this.anchor_index = 1;
		this.anchor_chatchannels_index = 1;
		this.user_id = user_id;
		this.el_chat_status_normal = $('#enjin-tray-messaging .user-list .normal');
		this.el_chat_status_minimal = $('#enjin-tray-messaging .user-list .minimal');
		this.el_chat_status = $('#enjin-tray-messaging .user-list .chat-status');
		this.el_chat_userlist = $('#enjin-tray-messaging .user-list .user-list-items');
		this.el_chat_anchor = $('#enjin-tray-messaging .wrapper-container .container.chat');
		this.el_chatchannel_anchor = $('#enjin-tray-chatchannels .wrapper-container .container');
		this.el_anchor_number = $('#enjin-tray-messaging .wrapper-container .user-list .normal .anchor-text');
		this.el_anchor_number_mini = $('#enjin-tray-messaging .wrapper-container .user-list .minimal .text');
		this.el_minimized_notification = $('#enjin-tray-messaging .user-list .minimal .notification');		
		this.el_filter_panel = $('#enjin-tray-messaging .wrapper-container .user-list .ulist .filter-panel');

		var el_quote = $('#enjin-tray-messaging .user-list-items .slist input[name=quote]');
		this.quote = el_quote.val();
		el_quote.bind('blur', function() {
			Enjin_Messaging_Tray.updateChatQuote();
		});
		Enjin_Core.bindEnter(el_quote, function() {
			Enjin_Messaging_Tray.updateChatQuote();
		});
		
		$('#enjin-tray-chat-user-hint').appendTo(document.body);
				
		this.sections_states = {};
		this.sections_states_saved = false;
		this.sections_states_searching = false;
		this.sections_states_searching_queue = false;
		
		
		$(Enjin_Messaging).bind('onMessageStatus', this.onMessageStatus);
		$(Enjin_Messaging).bind('onMessageChat', this.onMessageChat);
		$(Enjin_Messaging).bind('onMessageTyping', this.onMessageTyping);
		$(Enjin_Messaging).bind('onMessageSystemPrivateChatRequest', this.onMessagePrivateRequest);		
		$(Enjin_Messaging).bind('onMessageSystemProfileQuote', this.onMessageProfileQuote);		
		$(Enjin_Messaging).bind('onMessageSystemFriendAdd', this.onMessageSystemFriendAdd);		
		$(Enjin_Messaging).bind('onMessageSystemFriendRemove', this.onMessageSystemFriendRemove);
		
		$(Enjin_Messaging).bind('onModuleEtmpcRenderFriendsPusher', this.onModuleEtmpcRenderFriendsPusher);	
				
		this.initIdle();
		this.initPersistent();
		
		//check if we have a request for opening a chat
		var query = window.location.hash+"";
		var regex = /_messagingchat_([^=]+)=([^&]+)/g;
		var found;
		var data_channel = {"action": null};
		
		while ( (found = regex.exec(query)) !== null) {
    		data_channel[found[1]] = found[2];
    	}
    	
    	if (data_channel.action && data_channel.action == 'join') {
    	    data_channel.name = decodeURIComponent(data_channel.name);
    	    this.joinChatChannel(data_channel.presetid, data_channel.name, data_channel.count);
    	}
	},
	
	initPersistent: function() {
		var self = this;
		var fields = ['tray_mode'];
		this.persistence = new Enjin_Core_Persistence("messagingtray", this, fields)
				
		
		if (this.tray_mode == 'minimized') {
			//check status
			this.minimizeChatStatus();			
		} else {
			//show normal status
			this.hideUserList();
		}		
	},
	
	initPersistentChats: function() {
		var pc = []; //convert into array for sorting
		$.each(this.persistent_chats, function(key, value) {
			//do a checking of indexes
			pc.push({
				value: value, 
				index: value.index?value.index:1
			});
		});
		pc.sort(function(a, b){
			return a.index - b.index;
		});

		var chats_hash = {}; 
		var cuids = [];
		for (var i=0; i<pc.length; i++) {
			if (typeof pc[i].value['user_id'] != 'undefined') {
				//it's an user
				var user_id = pc[i].value.user_id;
				var hash = this.getChatHashUser(user_id);
				var chat_container = Enjin_Messaging_Tray.getChatUser(hash);

				if (user_id == Enjin_Messaging_Tray.user_id)
					continue;
								
				if (chats_hash[hash]
				    || chat_container)
					continue; //avoid duplicate
				
				chats_hash[hash] = hash;
				
				//regenerate index
				if (this.persistent_chats[hash]) {
					this.persistent_chats[hash].index = this.anchor_index;
					this.anchor_index++;
	
					cuids.push(user_id);
				}
			}
		}
		
		if (cuids.length > 0) { 
			Enjin_Messaging_Tray.ifUserCanChats(cuids, function(response) {
				for (var i=0; i<response.users.length; i++) {
					var data = response.users[i];
					var hash = Enjin_Messaging_Tray.getChatHashUser(data.user_id);
					
					if (data.can_chat) {
						var cuser_id = data.user_id;						
						var value = Enjin_Messaging_Tray.persistent_chats[hash];
						if (Enjin_Messaging_Tray.getChatUser(cuser_id))
							return; //already created
						
						//@todo check
						Enjin_Messaging_Tray.createChatElementsUser(cuser_id, value.index);
						
						var el = Enjin_Messaging_Tray.getChatUser(cuser_id);
						var item_history = Enjin_Messaging_Tray.persistent_chat_history[hash];
						if (item_history)
							el.container.persistentInit(item_history);
						
						if (self.tray_mode == 'minimized') {
							el.anchor.hide();
							el.container.hide();
						}						
					} else {
						//remove as not longer have it
						Enjin_Messaging.passRawMessage({
							calltype: 'persistentChatRemove',
							hash: hash
						});						
					}
				}
				
				Enjin_Messaging_Tray._initPersistentChatContainer(pc);
			});	
		} else {
			Enjin_Messaging_Tray._initPersistentChatContainer(pc);
		}
	},
	
	_initPersistentChatContainer: function(pc) {
		var chats_hash = {};
		for (var i=0; i<pc.length; i++) {
			if (typeof pc[i].value['type'] != 'undefined') {
				//new way
				var type = pc[i].value.type;
				if (type == 'chatchannel') {
					var preset_id = pc[i].value.preset_id;
					var hash = this.getChatHashChannel(preset_id);
					var chat_container = Enjin_Messaging_Tray.getChatChannel(preset_id);
					
					if (chats_hash[hash]
					    || chat_container)
						continue; //avoid duplicate
					
					chats_hash[hash] = hash;
					//regenerate index
					this.persistent_chats[hash].index = this.anchor_chatchannels_index;
					this.anchor_chatchannels_index++;
					
					//register to chat channel
					Enjin_Messaging_Pusher.addChatChannel(preset_id); 
					
					//create channel
					this.createChatChannelElements(preset_id);
					
					var el = this.getChatChannel(preset_id);
					el.container.hide(true);
					
					//set anchor part
					if (this.persistent_chats[hash].name)
						el.anchor.channelUpdateName(this.persistent_chats[hash].name);
					
					if (this.persistent_chats[hash].total)
						el.anchor.channelUpdateCount(this.persistent_chats[hash].total);
					
					var item_history = this.persistent_chat_history[hash];
					if (item_history)
						el.container.persistentInit(item_history);
					
					if (self.tray_mode == 'minimized') {
						el.anchor.hide();
						el.container.hide();
					}
				}
			}
		}		
		
		this._showChatChannelOptionTray();
		this.setOffsetActive();
	},
	
	setPrivateRequests: function(requests) {
		this.private_requests = requests;
		this.showPrivateRequests();
	},
	
	setSounds: function(preset_id, keys) {
		this.sound_preset = preset_id;
		this.sounds = keys;
	},
		
	previewSound: function() {
		var preset_id = $('#enjin-tray-messaging select[name=messaging_soundsettings]').val();
		this.loadPresetSound(preset_id, true);
		
		//save in ajax
		this.ajaxUpdateSound(preset_id);
	},
	
	loadPresetSound: function(preset_id, play) {
		if (preset_id &&  Enjin_Messaging_Tray.sounds[preset_id]) {
			this.sound_preset = preset_id;			
			if (play) {
				Enjin_Core.playSound(Enjin_Messaging_Tray.sounds[preset_id]);
			}
		} else {
			this.sound_preset = 0;
		}
	},
	
	soundPlay: function() {
		if (this.sound_preset)
			Enjin_Core.playSound(this.sounds[this.sound_preset]);
	},
	
	soundPlayPreset: function(preset_id) {
        if (this.sounds[preset_id])
            Enjin_Core.playSound(this.sounds[preset_id]);
	},
	
	updateChatQuote: function() {
		var new_quote = $.trim($('#enjin-tray-messaging input[name=quote]').val());
		if (new_quote != ''
			&& new_quote != this.quote) {
		
			$.get('/ajax.php?s=usertray&cmd=chat_options&name=quote&value=' + new_quote);
			this.quote = new_quote;
		}
	},
	
	persistentSaveWindows: function() {
		//send a request to postmessage
		Enjin_Messaging.passRawMessage({
			calltype: 'traySaveChats',
			chats: this.persistent_chats
		});	
	},
	
	initIdle: function() {
		$.idleTimer(600000);
		//$.idleTimer(70000);
		
		$(document).bind("idle.idleTimer", function(){
			if (Enjin_Messaging_Tray.myself_status == 'online') {
				Enjin_Messaging_Tray.myself_status_away = Enjin_Messaging_Tray.myself_status;
				Enjin_Messaging_Tray.sendUserStatus('away-idle');
			}
		});
		 
		$(document).bind("active.idleTimer", function(){
			if (Enjin_Messaging_Tray.myself_status_away) {
				var previous_state = Enjin_Messaging_Tray.myself_status_away; 
				Enjin_Messaging_Tray.myself_status_away = null;
				Enjin_Messaging_Tray.sendUserStatus(previous_state);
			}
		});		
	},
	
	isAjaxFriend: function(friend_id, callback) {
	    var self = this;
	    if (typeof this.ajaxFriends[friend_id] != 'undefined') {
	        callback.call(Enjin_Messaging_Tray, this.ajaxFriends[friend_id]);
	    } else {
	        var data = {
	            cmd: 'is-friend',
	            user_id: friend_id
	        };
	        
            $.post('/ajax.php?s=messaging', data, function(response) {
                self.ajaxFriends[friend_id] = response.is_friend;
                callback.call(Enjin_Messaging_Tray, response.is_friend);
            }, 'json');	        
	    }	  
	},
	
	isFriend: function(friend_id) {
		var is_friend = false;
		$.each(this.friends, function(key, value) {
			if (key == friend_id)
				is_friend = true;
		});
		
		return is_friend;
	},
	
	addFriendLink: function(user_id) {
		this.friends[user_id] = user_id;
	},
	
	addFriends: function(friends) {		
		for (var i=0; i<friends.length; i++) {
			this.friends[friends[i].user_id] = friends[i].user_id; //just make a pointer
			//since all information will be in users
		}
		
		this.addUsers(friends);
	},
	
	ifUserCanChat: function(user_id, callback, callback_false) {
		if (this.friends[user_id]) {
			callback.call(Enjin_Messaging_Tray, this.users[user_id]);
		} else {
			if (user_id == Enjin_Messaging_Tray.user_id) {
				//not worth to even check
				return;
			}
			
			//check in ajax
			var data = {
				cmd: 'have-private-chat',
				user_id: user_id
			}
			$.post('/ajax.php?s=messaging', data, function(response) {
				if (response.avatar) {
					response.user_id = user_id;
					if (response.is_friend)
						Enjin_Messaging_Tray.addFriendList(user_id, response);
					else
						Enjin_Messaging_Tray.addUsers([response]);
					callback.call(Enjin_Messaging_Tray, response);
				} else {
					if (callback_false) {
						callback_false.call(Enjin_Messaging_Tray, response);
					}
				}
			}, 'json');				
			
		}
		
		return null;
	},
	
	getCacheFirstLoadUid: function() {
		return 'msgtray_firstload_uids';
	},
	
	invalidateCacheFirstLoadUid: function() {
		Enjin_Core_Storage_Cache.invalidate(this.getCacheFirstLoadUid());
	},
	
	ifUserCanChats: function(user_ids, callback) {
		var clean_user_ids = [];
		for (var i=0; i < user_ids.length; i++) {
			if (user_ids[i] == Enjin_Messaging_Tray.user_id)
				continue; //remove itself
			
			clean_user_ids.push(user_ids[i]);
		}
		
		if (clean_user_ids.length == 0) {
			//not call
			callback.call(Enjin_Messaging_Tray, {user: []}); //empty array
			return;
		}
		
		//check in ajax
		var user_ids_str = clean_user_ids.join(',');
		var cache_key = Enjin_Messaging_Tray.getCacheFirstLoadUid();
		
		//function to process after load items/cache
		var fn_response = function(response) {
			if (!response.__dontcache) {
				Enjin_Core_Storage_Cache.set(cache_key, {response: response, user_ids: user_ids_str}, 3600); //cache for 1 hour
			}
			
			//add users
			for (var i=0; i<response.users.length; i++) {
				var data = response.users[i];
				var user_id = data.user_id;
			
				if (data.avatar) {
					Enjin_Messaging_Tray.addUsers([data]);
					
					if (data.is_friend)
						Enjin_Messaging_Tray.addFriendLink(user_id);
				}
			}
			
			callback.call(Enjin_Messaging_Tray, response);
		};
		
		
		//check in cache
		var cached = Enjin_Core_Storage_Cache.get(cache_key, null);
		if (cached) {
			if (cached.user_ids != user_ids_str) {
				//not longer valid
				Enjin_Messaging_Tray.invalidateCacheFirstLoadUid();
			} else if (cached.response.users) {
				//just process
				cached.response.__dontcache = true;
				fn_response(cached.response);
				return;
			}
		}
		
		var data = {
			cmd: 'have-private-chats',
			user_ids: user_ids_str
		}
				
		$.post('/ajax.php?s=messaging', data, fn_response, 'json');
		
		return null;
	},	
	
	addUsers: function(users) {
		for (var i=0; i<users.length; i++) {
			this.users[users[i].user_id] = users[i];
		}
	},
	
	setUserStatus: function(user_id, status) {
		if (this.users[user_id]) {
			this.users[user_id].messaging_status = status;
		}
	},
	
	getUserStatus: function(user_id) {
		if (this.users[user_id])
			return this.users[user_id].messaging_status;
		
		return null;
	},
	
	updateOnlineUsers: function() {
		if (this.userlist_show_first) {
			//haven't opened tray so just load through ajax
			var data = {
				cmd: 'get-online-count'
			}
			$.post('/ajax.php?s=messaging', data, function(response) {
				Enjin_Messaging_Tray.el_anchor_number.html(response.total+' online');
				Enjin_Messaging_Tray.el_anchor_number_mini.html(response.total);				
			}, 'json');
		} else {
			// get the friends total
			var grand_total = parseInt($('#enjin-tray-messaging .user-list .normal .anchor-text').text()) || 0;

			// go through each section
			$.each(['fav_friends', 'friends', 'site', 'minecraft'], function(i, type){
				var section = $('#enjin-tray-messaging .wrapper-container .user-list .user-list-items .section[data-type="' + type + '"]');
				if (section.find('.loading').length == 0) {
					// if the section has been loading then count the number of records
					var total = 0;
					section.find('.item').each(function(){
						if ($(this).css('display') != 'none') {
							total++;
						}
					});			
				} else {
					// if the section was not loaded then take the section total and +/- the added items
					var total = parseInt(section.find('.count').text()) || 0;
					var add = 0;
					var remove = 0;
					section.find('.item').each(function(){
						if ($(this).css('display') == 'none') {
							remove++;
						} else {
							add++;
						}
					});
					total = total + add - remove;
				}
				
				// update the section total
				section.find('.count').html(total);
				
				// update the grand total by using the friends total
				if ('friends' == type) {
					grand_total = total;
				}
			});

			// update the grand total
			$('#enjin-tray-messaging .user-list .normal .anchor-text').html(grand_total + ' online');	
			$('#enjin-tray-messaging .wrapper-container .user-list .minimal .mini-anchor .text').html(grand_total);
			
			/*var total = this.el_chat_userlist.find('.ulist .section-friends .friends-users .item').length
					- this.el_chat_userlist.find('.ulist .section-friends .friends-users .item .status-offline').length;
			
			this.el_anchor_number.html(total+' online');
			this.el_anchor_number_mini.html(total);
			
			this.section_friends.updateCount();*/
		}
	},
	
	getUserMe: function() {
		return this.getUser(this.user_id);
	},
	
	getUser: function(user_id) {
		if (this.users[user_id]) {
			return this.users[user_id];
		}
		
		return null;
	},
	
	hideChatStatus: function() {
		this.el_chat_status.hide();
		$('#enjin-tray-messaging .wrapper-container .user-list .normal .mini-anchor').removeClass('opened');
	},
	
	showChatStatus: function() {
		if (false === this.el_chat_status.is(':visible')) {
			this.el_chat_status.show();
			this.hideUserList();
			$('#enjin-tray-messaging .wrapper-container .user-list .normal .mini-anchor').addClass('opened');
		} else {
			this.hideChatStatus();			
		}
	},
	
	hideUserList: function() {
		this.hideSettingsPanel(); //just in case
		this.el_chat_userlist.hide();
	},
	showUserList: function() {
		this.onChatUserListShow();
		this.el_chat_userlist.show();
		this.hideChatStatus();
	},
	
	toggleChatUser: function(user_id) {
		var el = this.getChatUser(user_id);
		if (el) {
			if (el.container.visible()) {
				el.container.hide();
			} else {
				this.showChatUser(user_id);
			}
		}
	},
	
	toggleUserList: function() {
		this.hideChatStatus();
		
		if (!this.isVisibleUserList())
			this.onChatUserListShow();
		
		this.el_chat_userlist.toggle();
	},
	
	onChatUserListShow: function() {
		/*if (this.userlist_show_first) {
			//load
			this.loadUserlistTray();
		}*/
		
		//check if active is a channel type
		if (this.el_active && this.el_active.container instanceof Enjin_Messaging_Tray_ContainerChatChannel) {
			this._minimizeChat(this.el_active);
		}
	},
	
	isVisibleUserList: function() {
		return this.el_chat_userlist.is(':visible');
	},
	
	hideUserElements: function() {		
		this.hideChatStatus();
		this.hideUserList();
	},
	
	minimizeChatStatus: function() {
		this.persistence.set("tray_mode", "minimized");
		this.hideUserAnchorWindows();
		
		this.hideUserElements(); //just in case
		this.el_chat_status_normal.hide();
		this.el_chat_status_minimal.show();
		this.el_minimized_notification.hide();
	},
	expandChatStatus: function() {
		this.persistence.set("tray_mode", "full");
		
		this.el_chat_status_normal.show();
		this.el_chat_status_minimal.hide();
		this.el_minimized_notification.hide();
		
		this.showAnchorWindows();
		
		// also show the users list
		Enjin_Messaging_Tray.toggleUserList()
	},
	
	
	sendUserStatus: function(status) {
		var msg_status = status;
		if (status == 'away-idle')
			status = 'away'; //treat as normal
				
		Enjin_Messaging.sendUserStatus(msg_status);
		this.hideChatStatus();
		
		this.showMyselfStatus(status);
		
		this._updateChannelChatsUser(this.user_id, status);
	},
	
	showMyselfStatus: function(status) {
		this.myself_status = status;
		$('#enjin-tray-messaging .user-list .mini-anchor .icon').removeClass('status-online');
		$('#enjin-tray-messaging .user-list .mini-anchor .icon').removeClass('status-away');
		$('#enjin-tray-messaging .user-list .mini-anchor .icon').removeClass('status-invisible');
		$('#enjin-tray-messaging .user-list .mini-anchor .icon').removeClass('status-fav_friends');
		$('#enjin-tray-messaging .user-list .mini-anchor .icon').removeClass('status-offline');
		
		$('#enjin-tray-messaging .user-list .mini-anchor .icon').addClass('status-'+status);
	},
	
	_setItemStatus: function(el_main, status, hide_main) {
		var el = el_main.find('.icon');
		el.removeClass('status-online');
		el.removeClass('status-away');
		el.removeClass('status-invisible');
		el.removeClass('status-fav_friends');
		el.removeClass('status-offline');
		el.addClass('status-'+status);
		
		if (hide_main) {
			if (status == 'offline') 
				el_main.hide();
			else
				el_main.show();
		}
	},	
	
	minimizeOpenWindows: function(skip) {
		if (!skip) {
			this.el_active = null; //will minimize all
		}
		
		//minimize all chats
		$.each(this.chats, function(key, el) {
			if (skip && skip.type == 'chat' && skip.id == key) {
				return; //don't close this
			} else {
				el.container.hide();
			}
		});		
	},
	
	hideUserAnchorWindows: function() {
		this.hideAnchorWindows('user');
	},
	hideAnchorWindows: function(type) {
		$.each(this.chats, function(key, el) {
			if ( typeof type === 'undefined' || el.type == type ) {
				el.anchor.hide();
				el.container.hide();	
			}
		});		
	},
	showAnchorWindows: function() {
		$.each(this.chats, function(key, el) {
			el.anchor.show();
			el.container.hide();
		});		
	},
	
	setNotificationNumber: function() {
		if (this.tray_mode == 'minimized')
			this.el_minimized_notification.show();
	},

	
	startChatChecking: function(user_id) {
		if (!Enjin_Messaging_Tray.isFriend(user_id)) {
			Enjin_Messaging_Tray.requestPrivateChat(user_id);	
		} else {
			Enjin_Messaging_Tray.startChatUserList(user_id);
		}
	},
	
	startChatUserList: function(user_id) {
		Enjin_Messaging_Tray.loadUser(user_id, function() {
			Enjin_Messaging_Tray.startChatUser(user_id, true);
			Enjin_Messaging_Tray.hideUserList();		
		});		
	},	
	
	startChatUser: function(user_id, fulldisplay) {
		var el = this.getChatUser(user_id);
		var show = fulldisplay;
		if (!el) {
			//Create only if is user			
			Enjin_Messaging_Tray.createChatElementsUser(user_id);
			el = this.getChatUser(user_id);
			el.container.persistentSave();
		} else {
			show = el.anchor.isMinimized();
		}
		
		if (show) {
			this.showChatUser(user_id);
		}

		//save to persistent
		var hash = this.getChatHashUser(user_id);
		this.persistent_chats[hash] = {type: 'user', v: 'v2', user_id: user_id, show: show?1:0, index: this.anchor_index};
		this.anchor_index++;
		this.persistentSaveWindows();
		this.setOffsetActive(); //update if needed
		
		return el;
	},
	
	getChatHash: function(type, chat_id) {
		return type+"_"+chat_id;
	},
	getChatHashUser: function(user_id) {
		return this.getChatHash('user', user_id);
	},
	getChatHashChannel: function(preset_id) {
		return this.getChatHash('chatchannel', preset_id);
	},
	
	getChatUser: function(user_id) {
		var hash = this.getChatHashUser(user_id);
		return this.chats[hash];
	},
	
	getChatChannel: function(preset_id) {
		var hash = this.getChatHashChannel(preset_id);
		return this.chats[hash];
	},	
	
	showChatUser: function(user_id) {
		var el = this.getChatUser(user_id);
		this._showChat(el);
	},
	
	showChatChannel: function(preset_id) {
		var el = this.getChatChannel(preset_id);
		this._showChat(el);
	},
	
	
	_showChat: function(el) {
		if (el) {
			//hide others
			this.minimizeOpenWindows();
			this.hideUserElements(); //just in case
			
			this.el_active = el;
			this.setOffsetEl(el);
		}
	},
	
	setOffsetActive: function() {
		if (this.el_active)
			this.setOffsetEl(this.el_active);
	},
	
	setOffsetEl: function(el) {
		var offset = el.anchor.getBounds();	
		el.anchor.setSelected(true);
		el.container.show(offset);
	},
	
	createChatElementsUser: function(user_id, index) {
		var anchor = Enjin_Messaging_Tray.createAnchorUser({user_id: user_id});
		var hash = Enjin_Messaging_Tray.getChatHashUser(user_id);
		this.chats[hash] = {
			type: 'user',
			user_id: user_id,
			anchor: anchor,
			container: new Enjin_Messaging_Tray_Container(user_id, anchor)
		};
		
		this._createChatElements(hash, index, this.el_chat_anchor);
	},
	
	_createChatElements: function(hash, index, anchor) {
		//append the anchor
		if (!index) {
			anchor.append(this.chats[hash].anchor.getEl());
		} else {
			//look who has the next index
			var nindex = index+1;			
			var nel = null;
			
			$.each(this.persistent_chats, function(key, value) {
				if (value.index == nindex) {
					nel = Enjin_Messaging_Tray.chats[key];
				}
			});
			
			if (!nel) {
				anchor.append(this.chats[hash].anchor.getEl());
			} else {
				this.chats[hash].anchor.getEl().insertBefore(nel.anchor.getEl());
			}			
		}
	},
	
	cleanDisplaynameLength: function(displayname, length) {
		var username = Enjin_Core.html_entity_decode(displayname);
		
		if (username.length > length)
			username = username.substr(0, length)+'...';
		
		return Enjin_Core.htmlentities(username);
	},
	
	teaser: function(text, length, escape) {
		if (text.length > length)
			text = text.substr(0, length)+'...';
		
		if (escape)
			return Enjin_Core.htmlentities(text);
		
		return text;
	},
	
	minimizeChatUser: function(user_id) {
		var el = this.getChatUser(user_id);
		this._minimizeChat(el);
	},
	
	_minimizeChat: function(el) {
		if (el) {
			if (el == this.el_active)
				this.el_active = null;	
			
			el.container.hide();
		}
	},
	
	closeChatUser: function(user_id) {
		var el = this.getChatUser(user_id);
		var hash = this.getChatHashUser(user_id);
		delete this.chats[hash];
		delete this.persistent_chats[hash];
		
		if (el) {
			this._closeChat(el);
			
			if (this.private_requests[user_id]) {
			    if (this.private_requests[user_id].myself_requested) {
			    	//remove request
					var data = {
		    			cmd: 'remove-request',
		    			user_id: user_id
		    		};
		    		
		    		$.post('/ajax.php?s=messaging', data, function(response) {
		    			Enjin_Messaging_Tray.removePrivateRequestAll(user_id);		    			
		    		}, 'json');	
			    	
			    	
			    } else {
					//treat as ignore
					this.ajaxIgnoreUser(user_id);
			    }
			}			
		}
	},
	
	closeChatChannel: function(preset_id) {
		var el = this.getChatChannel(preset_id);
		var hash = this.getChatHashChannel(preset_id);
		delete this.persistent_chats[hash];
		
		if ( el.anchor.open_tray !== true ) {
			delete this.chats[hash];
		}
		
		this._closeChat(el);		
	},
	
	
	_closeChat: function(el) {
		if (el) {
			if (el == this.el_active)
				this.el_active = null;

			// if the channel has been flagged as staying open in the tray we must just hide
			// the container and X and not remove the anchor, otherwise we remove everything to cleanup
			/*if ( el.anchor.open_tray === true ) {
				el.container.hide();
				el.anchor.channelHideX();
			} else {
				el.container.remove();
				el.anchor.remove();
			}*/
			el.container.remove();
			if ( el.anchor.open_tray !== true ) {
				el.anchor.remove();
			} else {
				el.anchor.channelHideX();
			}
			
			//save to persistent
			
			this.persistentSaveWindows();
			this.setOffsetActive();			
		}
	},
	
	removePrivateRequestAll: function(user_id) {
		this.removeBlockIgnoreUser(user_id);
		
		this.removePrivateRequest(user_id);
		this.hidePrivateRequestOptionsPopup();
		this.closeChatUser(user_id);
	},
	
	showPrivateRequestOptionsPopup: function(user_id) {
		//load data
		var data = {
			cmd: 'load-user',
			user_id: user_id
		}
		$.post('/ajax.php?s=messaging', data, function(response) {
			var el = $('.element_popup.messaging-optionsprivatechat');
			$('.element_popup.messaging-optionsprivatechat').attr('data-userid', user_id);			
			
			el.find('.avatar').html(response.avatar);
			el.find('.username').html(response.displayname);
			
			Enjin_Messaging_Tray.show_popup = true;
			Enjin_Messaging_Tray.show_popup_userid = user_id;
			Enjin_Core.createPopupSeparator();
			Enjin_Core.placeAfterPopupSeparator(el);
			Enjin_Core.centerPopup(el);
			el.show();			
		}, 'json');				
	},
	
	hidePrivateRequestOptionsPopup: function(message) {
		this.show_popup = false;
		this.show_popup_userid = null;
		$('.element_popup.messaging-optionsprivatechat').hide();
		Enjin_Core.removePopupSeparator();
		
		if (message)
			Enjin_Core.alert(message);
	},
	
	showPrivateRequests: function() {
		jQuery.each(this.private_requests, function(user_id, item) {
			Enjin_Messaging_Tray.addUsers([item]);
			Enjin_Messaging_Tray.showPrivateRequestuser(user_id);
		});		
	},
	showPrivateRequestuser: function(user_id) {
		var item = this.users[user_id];
		
		Enjin_Messaging_Tray.startChatUser(user_id, true); 			
		Enjin_Messaging_Tray.showChatUser(user_id);
		
		if (!item.is_friend) {
			//this code should be always used, but just in case
			var el = Enjin_Messaging_Tray.getChatUser(user_id);
			
			if (item.myself_requested)
				el.container.showRequestWaiting();
			else
				el.container.showRequestConfirmation(item.displayname);
		}	
	},
		
	
	requestLocalPrivateChat: function(user_id) {
		var self = Enjin_Messaging_Tray;		
		
		if (!self.friends[user_id]) {
			//check if have in request
			var item = self.private_requests[user_id];
			
			if (!item) {
				//load data
				self.private_requests[user_id] = {
					myself_requested: false
				}; //temporary
				
				var data = {
					cmd: 'load-user-chat',
					user_id: user_id
				}
				$.post('/ajax.php?s=messaging', data, function(response) {
					Enjin_Messaging_Tray.addUsers([response]);
					Enjin_Messaging_Tray.showPrivateRequestuser(user_id);
				}, 'json');				
			} else {
				//just show
				Enjin_Messaging_Tray.showPrivateRequestuser(user_id);
			}
		} else {
			Enjin_Messaging_Tray.startChatUser(user_id, true); 
			Enjin_Messaging_Tray.showChatUser(user_id);
		}		
	},
	
	removePrivateRequest: function(user_id) {
		delete this.private_requests[user_id];
	},
	
	loadUser: function(user_id, callback) {
		var user = this.getUser(user_id);

		if (!user) {
			this.getUserChatData(user_id, function(response) {
			    if (response.is_friend)
			     Enjin_Messaging_Tray.addFriends([response]);
			    else
				    Enjin_Messaging_Tray.addUsers([response]);
				callback.call(Enjin_Messaging_Tray, user_id);
			});
		} else {
			callback.call(Enjin_Messaging_Tray);
		}
	},
	
	getUserChatData: function(user_id, callback) {
		var data = {
			cmd: 'load-user-chat',
			user_id: user_id
		}
		$.post('/ajax.php?s=messaging', data, function(response) {
			callback.call(Enjin_Messaging, response);
		}, 'json');
	},
	
	acceptPrivateRequest: function(user_id, message, callback) {
		//nothing but hide and show the chat
		var data = {
			cmd: 'accept-private-chat',
			user_id: user_id
		}
		if (message)
			data.message = message;
		
		$.post('/ajax.php?s=messaging', data, function(response) {
			if (response.error) {
				Enjin_Core.alert("Failed to send response");
			} else {
				response.user_id = user_id;
				Enjin_Messaging_Tray.addUsers([response]);
				Enjin_Messaging_Tray.removePrivateRequest(user_id);
				
				//show chat
				var chat = Enjin_Messaging_Tray.getChatUser(user_id, true);
				if (chat) {
					chat.container.showPrivateChat(); //allow to send messages
				}
				
				if (callback)
					callback.call(Enjin_Messaging_Tray, response);
			}
		}, 'json');
	},
		
	ajaxBlockUser: function(user_id) {
		if (!user_id)
			user_id = this.show_popup_userid;
		
		var data = {
			cmd: 'block-user',
			user_id: user_id
		};
		
		$.post('/ajax.php?s=messaging', data, function(response) {
			//remove chat			
			Enjin_Messaging_Tray.removePrivateRequest(user_id);
			Enjin_Messaging_Tray.hidePrivateRequestOptionsPopup();
			Enjin_Messaging_Tray.closeChatUser(user_id);
		}, 'json');	
	},
	ajaxIgnoreUser: function(user_id) {
		if (!user_id)
			user_id = this.show_popup_userid;
		
		var data = {
			cmd: 'ignore-request',
			user_id: user_id
		};
		
		$.post('/ajax.php?s=messaging', data, function(response) {
			Enjin_Messaging_Tray.removePrivateRequestAll(user_id);
		}, 'json');	
	},
	
	removeBlockIgnoreUser: function(user_id) {
		if (this.users[user_id])
			delete this.users[user_id];
		
		//just in case
		if (this.friends[user_id])
			delete this.friends[user_id];
		
		this.closeChatUser(user_id);
	},
	
	/*request private chat */
	requestPrivateChat: function(user_id) {
		//load user to save in persistent
	
		var data = {
			cmd: 'request-private-chat',
			user_id: user_id
		}
		$.post('/ajax.php?s=messaging', data, function(response) {
            // if the user is blocked then skip the whole thing
            if (response.is_blocked) {
                Enjin_Core.alert("The user blocked you");
                return;
            }            
            
		    Enjin_Messaging_Tray.addUsers([response]);
		    
		    if (response.error == 'already_friend') {
		        Enjin_Messaging_Tray.startChatUserList(user_id); //already is a friend
		        return;
		    }			
			
			if (response.error) {
				//show that user don't accept requests
				Enjin_Messaging_Tray.startChatUser(user_id, true); 			
				Enjin_Messaging_Tray.showChatUser(user_id);
				
				var el = Enjin_Messaging_Tray.getChatUser(user_id);
				el.container.showNotAccepting();				
			} else {			
				var is_enabled = false;
				if (response.start_chat) {
					is_enabled = true;
					delete response['start_chat'];
				}
				
				response.user_id = user_id;
				Enjin_Messaging_Tray.private_requests[user_id] = {
					myself_requested: true
				}; //temporary
				
				if (!is_enabled)
					$('.element_button.element_profile_privatechat input').val('Contacting...');
				else
					$('.element_button.element_profile_privatechat input').val('Chat');				
	
				Enjin_Messaging_Tray.startChatUser(user_id, true); 			
				Enjin_Messaging_Tray.showChatUser(user_id);
				
				if (!is_enabled) {
					var el = Enjin_Messaging_Tray.getChatUser(user_id);
					el.container.showRequestWaiting();
				}
			}
			
		}, 'json');		
	},	
	
	addAsFriend: function() {
		var user_id = $('.element_popup.messaging-optionsprivatechat').attr('data-userid');
		var data = {
			op: 'add',
			user_id: user_id
		}
		$.post('/ajax.php?s=friends', data, function(response) {
			Enjin_Messaging_Tray.hidePrivateRequestOptionsPopup("You are now friends with "+response.displayname);
		}, 'json');
	},
	
	ajaxUpdateSound: function(preset_id) {
		var data = {
			cmd: 'save-setting-sound',
			sound_id: preset_id
		};
		
		$.post('/ajax.php?s=messaging', data, function(response) {
		}, 'json');						
	},
	
	/* settings part */
	showSettingsPanel: function() {
		var box = $('#enjin-tray-messaging .user-list-items .slist');
		if (box.is(':visible')) {
			box.hide();
		} else {
			box.show();
		}
	},
	hideSettingsPanel: function() {
		$('#enjin-tray-messaging .user-list-items .slist').hide();
	},
	
	settingsUpdateChatPrivacy: function() {
		var params = {
				cmd: "chat_privacy", 
				'chat-privacy': $('#enjin-tray-messaging input[name=chat-privacy]').is(':checked') ? 'on' : ''
		};
		
		$.post("/ajax.php?s=dashboard_account", params,
			function(data)
			{
				if ( data.error == 0 ) 
				{ 
				}
			}
		);
	},
	
	addFriendList: function(user_id, response, options) {
		Enjin_Messaging_Tray.addFriends([response]);
		
		var el = Enjin_Messaging_Tray.el_chat_userlist.find('.ulist .section-friends .friends-users');
		
		Enjin_Messaging_Tray.renderFriendList(el, user_id, options);		
		Enjin_Messaging_Tray.updateOnlineUsers();		
	},
	
	renderFriendList: function(el, user_id, options) {
		var response = Enjin_Messaging_Tray.getUser(user_id);
		if (!response)
			return; //not render something not found		
		
		var options = $.extend({
			render_offline: false,
			site_admin: false
		}, options);
		
		if ( el.find('.item[data-userid='+user_id+']').length == 0) {
			var style = '';
			if (!options.render_offline && response.messaging_status == 'offline')
				style = ' style="display: none;"';
			
			var callback = 'startChatUserList';
			if (!Enjin_Messaging_Tray.isFriend(user_id))
				callback = 'requestPrivateChat';
			
			var shell_extra = '';
			var classes = ['item'];
			var displayname = Enjin_Messaging_Tray.cleanDisplaynameLength(response.displayname, 15);
			
			if (options.site_admin) {
				classes.push('site-admin');
				shell_extra = '<div class="sicon"><!-- --></div>'
			}
			
			classes = classes.join(' ');
			var html = 	'<div class="'+classes+'" data-userid="'+user_id+'" data-name="'+Enjin_Core.htmlentities(response.displayname)+'"'+style+'>\
				<div class="icon bg status-'+response.messaging_status+'"><!--  --></div>\
				<div class="avatar">\
					<div>'+shell_extra+'<a href="javascript:void(0)" onclick="Enjin_Messaging_Tray.'+callback+'('+user_id+')"><img src="'+response.avatar_small+'" /></a></div></div>\
				<div class="displayname">\
					<a href="javascript:void(0)" onclick="Enjin_Messaging_Tray.'+callback+'('+user_id+')">'+displayname+'</a>\
				</div>\
				<div class="clearing"><!--  --></div>\
			</div>';
				
			//find where to insert
			var items = el.find('.item');
			var found = false;
			var newel = null;
			jQuery.each(items, function() {
				if (!found) {
					var dname = $(this).find('.displayname a').text();
					if (dname.localeCompare(response.displayname) > 0) {
						//our string is greater so insert before this
						$(html).insertBefore($(this));
						found = true;
					}
				}
			});
				
			if (!found) //just append
				el.append(html);
			
			newel = el.find('.item[data-userid='+user_id+']');
			newel.bind('mouseover', Enjin_Messaging_Tray.onFriendListItemOver); 
			newel.bind('mouseout', Enjin_Messaging_Tray.onFriendListItemOut); 
		}		
	},
	
	onFriendListItemOver: function(evt) {
		var el = $(evt.currentTarget);
		if (!el.is(':visible')) return; //not show on hidden
		
		if (el.hasClass('item-channel'))
			$('#enjin-tray-chat-user-hint .round').html(Enjin_Messaging_Tray.label_channels);
        else if (el.hasClass('item-minecraft-player'))
            $('#enjin-tray-chat-user-hint .round').html(Enjin_Messaging_Tray.label_channels);			
		else
			$('#enjin-tray-chat-user-hint .round').html(Enjin_Messaging_Tray.label_chat);
		
		var offset = el.offset();
		var right = $(window).width() - offset.left - 5;
		var bottom = $(window).height() - offset.top - 22;
		
		$('#enjin-tray-chat-user-hint').css('right', right);
		$('#enjin-tray-chat-user-hint').css('bottom', bottom);
		$('#enjin-tray-chat-user-hint').show();
	},
	onFriendListItemOut: function(evt) {
		$('#enjin-tray-chat-user-hint').hide();
	},

	/* events from messaging */
	onMessageStatus: function(evt, message) {
		var user_id = message.userId;
		var status = message.data;
		var update_friends = false;
		
		//update all in tray
		Enjin_Messaging_Tray.el_chat_anchor.find('div[data-userid='+user_id+']').each(function() {
			Enjin_Messaging_Tray._setItemStatus($(this), status);
		});
				
		if (!Enjin_Messaging_Tray.userlist_show_first) {
			var found = false;
			Enjin_Messaging_Tray.el_chat_userlist.find('.ulist .items-panel div[data-userid='+user_id+']').each(function() {
				Enjin_Messaging_Tray._setItemStatus($(this), status, true);				
				
				//@todo check if can be reused
				if ($(this).closest('.section-friends').length > 0) {
					found = true;				
					update_friends = true;
				};
			});			
			
			var closure_friends = function() {
				//update count
				//Enjin_Messaging_Tray.section_friends.updateCount();
				Enjin_Messaging_Tray.updateOnlineUsers();
				
				var filter_el = Enjin_Messaging_Tray.el_filter_panel.find('input[type=text]');
				var text = $.trim(filter_el.val());				
				if (text != "" && text != filter_el.attr('placeholder'))
					Enjin_Messaging_Tray.onFilterSearch(); //do again the searching
			};
			
			if (!found) {
				//possible it's a new friend, so load data
				Enjin_Messaging_Tray.getUserChatData(user_id, function(data) {
					data.user_id = user_id;
					if (data.is_friend) {
						Enjin_Messaging_Tray.addFriendList(user_id, data);						
						closure_friends.call(Enjin_Messaging_Tray);
						
						if (status == 'online')
							Enjin_Messaging_Tray.notifyOnline(user_id);
					}					
				});				
				
			} else if (update_friends) {
				closure_friends.call(Enjin_Messaging_Tray);
				
				if (status == 'online')
					Enjin_Messaging_Tray.notifyOnline(user_id);
			}
						
			Enjin_Messaging_Tray.pusherSiteChannelStatus(Enjin_Messaging_Pusher.site_id, user_id, status);
		} else {
			//ajax update
			if (status == 'online')
				Enjin_Messaging_Tray.notifyOnline(user_id);
			
			Enjin_Messaging_Tray.updateOnlineUsers();
		}
		
		//Enjin_Messaging_Tray._updateChannelChatsUser(user_id, status); //not needed as proper container will do it
	},
	
	notifyOnline: function(user_id) {
		Enjin_Messaging_Tray.loadUser(user_id, function() {
			var user = Enjin_Messaging_Tray.getUser(user_id); 
			if (user.is_friend) {
				Enjin_Core.Notifications.addGrowl({
					avatar: user.avatar,
					username: user.username.replace(/\<a /, '<span ').replace(/\<\/a\>/, '</span>'),
					growl_class: 'growl_online',
					growl_type: '',
					growl_text: 'is online',
					growl_game: ''
				});
			}
		});
	},	
	
	// not used, so why does it even exist?
    /*notifyPlayerOnline: function(player) {
		Enjin_Core.Notifications.addGrowl({
			avatar: 'https://cravatar.eu/helmavatar/' + player + '/74.png',
			username: '<span class="element_username">' + player + '</span>',
			growl_class: 'growl_online_game',
			growl_type: '',
			growl_text: 'is online on',
			growl_game: 'Minecraft',
		});
    },*/
	
	_updateChannelChatsUser: function(user_id, status) {
		//do for fast dom
		$('.chat-container-channel .item[data-userid='+user_id+']').each(function() {
			var el = $(this).find('.icon');

			el.removeClass('status-online');
			el.removeClass('status-away');
			el.removeClass('status-invisible');
			el.removeClass('status-fav_friends');
			el.removeClass('status-offline');
			el.addClass('status-'+status);			
		});
	},
	
	onMessageChat: function(evt, message) {
		var el;
		
		el = Enjin_Messaging_Tray.getChatUser(message.userId);
		if (Enjin_Messaging_Tray.myself_status == 'invisible'
			|| Enjin_Messaging_Tray.myself_status == 'offline') {
			//skip messages if they aren't in a chat			
			if (el)
				Enjin_Messaging_Tray.onMessageChatContinue(message, el);
		} else {			
			if (el) {
				Enjin_Messaging_Tray.onMessageChatContinue(message, el);
			} else {
				Enjin_Messaging_Tray.ifUserCanChat(message.userId, function(response) {
					var cuser_id = response.user_id;
					el = Enjin_Messaging_Tray.startChatUser(cuser_id, false);
					Enjin_Messaging_Tray.onMessageChatContinue(message, el);
				});
			}
		}
	},
	
	onMessageTyping: function(evt, message) {
		var el;
		
		el = Enjin_Messaging_Tray.getChatUser(message.userId);
		if (el)
			el.container.addMessageTyping();
	},
	
	onMessageChatContinue: function(message, el) {		
		var time = new Date(message.timestamp);
		el.anchor.addNotification();
		
		var msg = message.data;
		if (message.namespace == 'system-private-chat-request')
			msg = message.data.message;
		
		el.container.addMessageText(false, msg, time);
		
		//play sound
		this.soundPlay();
	},
	
	onMessagePrivateRequest: function(evt, message) {
		//show message
		var user_id = message.userId;
		var type = message.data.type;
		
		if (type == 'request') {
			Enjin_Messaging_Tray.requestLocalPrivateChat(user_id);
		} else if (type == 'allow') {
			Enjin_Messaging_Tray.onMessagePrivateRequestAccept(evt, message);
			if (message.data.message) {
				var chat = Enjin_Messaging_Tray.startChatUser(user_id, true); 
				Enjin_Messaging_Tray.showChatUser(user_id);
				if (chat) {
					Enjin_Messaging_Tray.onMessageChatContinue(message, chat);
				}
			}
			
			$('.element_button.element_profile_privatechat').hide();
		} else if (type == 'ignore'
			|| type == 'block') {
			$('.element_button.element_profile_privatechat').hide();
			
			var chat = Enjin_Messaging_Tray.getChatUser(user_id);
			if (chat) {
				if (chat.container.normalChat()) {
					chat.container.showIgnore(type == 'block');
				} else {
					chat.container.showDeclined();
				}
			}			
		} else if (type == 'remove') {
			//user has dropped the request, so just remove
			Enjin_Messaging_Tray.removePrivateRequestAll(user_id);
		}
	},
	
	onMessagePrivateRequestAccept: function(evt, message) {
		var user_id = message.userId;
		
		var el = Enjin_Messaging_Tray.startChatUser(user_id, true); 
		Enjin_Messaging_Tray.showChatUser(user_id);
		
		el.container.showPrivateChat();
	},
	
	onMessageProfileQuote: function(evt, message) {
		//update user if have chat
		var user_id = message.userId;
		var chat = Enjin_Messaging_Tray.getChatUser(user_id);
		if (chat) {
			chat.container.updateTopic(message.data.quote);
		}
	},
	
	onMessageSystemFriendAdd: function(evt, message) {
		var user_id = message.userId;
		
		Enjin_Messaging_Tray.invalidateCacheFirstLoadUid(); //must revalidate, even maybe is not needed
		
		//load through ajax
		var data = {
			cmd: 'load-user-chat',
			user_id: user_id
		}
		$.post('/ajax.php?s=messaging', data, function(response) {
			response.user_id = user_id;
			Enjin_Messaging_Tray.addFriendList(user_id, response);
		}, 'json');		
	},
	
	onMessageSystemFriendRemove: function(evt, message) {
		var user_id = message.userId;
		
		//remove from list
		var el_main = Enjin_Messaging_Tray.el_chat_userlist.find('.ulist .item[data-userid='+user_id+']');
		el_main.remove();
		
		if (Enjin_Messaging_Tray.friends[user_id])
			delete Enjin_Messaging_Tray.friends[user_id];
		
		Enjin_Messaging_Tray.closeChatUser(user_id);
		Enjin_Messaging_Tray.updateOnlineUsers();
	},

	pusherSiteChannelStatus: function(site_id, user_id, status) {
		var section = this.sections[site_id];
		if (section) {
			if (!this.userlist_show_first) {
				//add to section
				return section.updateStatus(user_id, status);
			}
		}
		
		return false;
	},
	
	
	pusherSiteJoin: function(site_id, html) {
		var section = this.sections[site_id];
		if (section) {
			if (!this.userlist_show_first) {
				//add to section
				section.joinUser(html);
			}
		}
	},
	
	pusherSiteLeave: function(site_id, user_id) {
		var section = this.sections[site_id];
		if (section) {
			if (!this.userlist_show_first) {
				//add to section
				section.removeUser(user_id);
			}
		}
	},
	
	/* "util" function */
	makeUrl: function(text) {
		var fn_replace = function(string_url) {
			var url = string_url;
			if (url.substr(0, 7) != 'http://'
				&& url.substr(0, 8) != 'https://')
				url = "http://"+url;
				
	        return '<a target="_blank" href="' + url + '">' + string_url + '</a>';
	    };
		
	    var urlRegex = /((https?:\/\/)?[^\s]+(\.[^\s]+)+(\/[^\s]+)*)/g;
	    text = text.replace(urlRegex, fn_replace);
	    
	    return text;
	},	
	
	onModuleEtmpcRenderFriendsPusher: function(evt, data) {
		Enjin_Messaging_Tray.showMyselfStatus(Enjin_Messaging_Tray.myself_status);
		Enjin_Messaging_Tray.persistent_sectionstates = data.sections;
						
		Enjin_Messaging_Tray.persistent_chats = data.chats;
		Enjin_Messaging_Tray.persistent_chat_history = data.chat_history;
		
		if (!Enjin_Messaging_Tray.persistent_chats)
			Enjin_Messaging_Tray.persistent_chats = {};
		
		if (!Enjin_Messaging_Tray.persistent_chat_history)
			Enjin_Messaging_Tray.persistent_chat_history = {};
		
		Enjin_Messaging_Tray.initPersistentChats();
		
		//don't show tray until we are in the channel
		Enjin_Pusher.onReady(function() {
			Enjin_Messaging_Pusher.startUserChannel();
		});
	},	

	_preparePusherUserChannel: function() {
		//show the tray as we are ready
		$('#enjin-tray-messaging').show();
		this.setOffsetActive();
	},
	
	/*loadUserlistTray: function() {
		var ajaxdata = {
			cmd: 'load-tray',
			site_id: this.site_id
		}
		
		if (Enjin_Messaging_Pusher.channel_site_users)
			ajaxdata.user_ids = Enjin_Messaging_Pusher.channel_site_users.join(",");

		$.post('/ajax.php?s=messaging', ajaxdata, function(response) {					
			var el = Enjin_Messaging_Tray.el_chat_userlist.find('.ulist .items-panel')[0];
			if (response.double_render) {
				//load through other ajax
				ajaxdata.cmd = 'load-tray-raw';
				$.post('/ajax.php?s=messaging', ajaxdata, function(response_html) { 
					el.innerHTML = response_html;
					Enjin_Messaging_Tray._loadUserListTrayContinue(response);
				});
			} else {
				el.innerHTML = response.html_tray;
				Enjin_Messaging_Tray._loadUserListTrayContinue(response);
			}			
			
			
			
			
		}, 'json');
	},*/
	
	_loadUserListTrayContinue: function(type) {
		Enjin_Messaging_Tray.userlist_show_first = false;
		
		// generate sections        
		Enjin_Messaging_Tray.default_sections = [];
		switch (type) {
			case 'fav_friends':
				Enjin_Messaging_Tray.el_section_favfriend = Enjin_Messaging_Tray.el_chat_userlist.find('.section-favfriends');					
				Enjin_Messaging_Tray.section_favfriends = new Enjin_Messaging_Tray_Section('favfriends', 'default_favfriends', Enjin_Messaging_Tray.el_section_favfriend);
				Enjin_Messaging_Tray.default_sections.push(Enjin_Messaging_Tray.section_favfriends);
				break;
				
			case 'friends':
				Enjin_Messaging_Tray.el_section_friend = Enjin_Messaging_Tray.el_chat_userlist.find('.section-friends');					
				Enjin_Messaging_Tray.section_friends = new Enjin_Messaging_Tray_Section('friends', 'default_friends', Enjin_Messaging_Tray.el_section_friend);
				Enjin_Messaging_Tray.default_sections.push(Enjin_Messaging_Tray.section_friends);
				break;
				
			case 'site':
				var site_id = Enjin_Messaging_Tray.site_id;
				var newEl = $('#enjin-tray-messaging .user-list .user-list-items .section-sites .section[data-siteid='+site_id+']');
				var section = new Enjin_Messaging_Tray_Sectionlist(site_id, newEl);
				Enjin_Messaging_Tray.sections[site_id] = section;
				break;
				
			case 'minecraft':
				newEl = $('#enjin-tray-messaging .user-list .user-list-items .section-ingame .section');
				section = new Enjin_Messaging_Tray_Section('ingame', "ingame_friends", newEl);
				Enjin_Messaging_Tray.sections_ingame[site_id] = section;
				break;
		}
		
		// add the hover on the user's list
		newel = $('#enjin-tray-messaging .user-list .user-list-items .section[data-type="' + type + '"] .item-chat-hover');
		newel.bind('mouseover', Enjin_Messaging_Tray.onFriendListItemOver); 
		newel.bind('mouseout', Enjin_Messaging_Tray.onFriendListItemOut); 
		
		//add events to filter
		//init filter keydown
		Enjin_Messaging_Tray.el_filter_panel.find('.icon').bind('click', Enjin_Messaging_Tray.onFilterIconClick)
		Enjin_Messaging_Tray.el_filter_panel.find('input[type=text]').bind('keyup', Enjin_Messaging_Tray.onFilterSearch)
		
		// update the online users count
		Enjin_Messaging_Tray.updateOnlineUsers();		
	},
	
	/* filter part */
	onFilterIconClick: function() {
		if (Enjin_Messaging_Tray.sections_states_saved) {
			Enjin_Messaging_Tray.el_filter_panel.find('input[type=text]').val('');
			Enjin_Messaging_Tray.el_filter_panel.find('input[type=text]').blur();
			Enjin_Messaging_Tray.filterReset();
		}
	},
	
	onFilterSearch: function() { 
		var self = Enjin_Messaging_Tray;
	
		if (self.sections_states_searching) {
			//just tell we are in a queue
			self.sections_states_searching_queue = true;
			return;
		}
			
	
		self.sections_states_searching = true;
		self.sections_states_searching_queue = false;
		
		if (!self.sections_states_saved) {
			self.sections_states_saved = true;
			self.filterSaveState();
		}		
		var query = self.el_filter_panel.find('input[type=text]').val();
		query = $.trim(query);
		query = query.toLowerCase();
		query = query.replace(/ +/, ' ');
		
		if (query != "") {
			self.el_filter_panel.find('.icon').addClass('search');
			
			for (var i=0; i<self.default_sections.length; i++) {
				self.default_sections[i].expand();
				self.default_sections[i].filterSearch(query);
			}
			
			$.each(self.sections, function(site_id, sectionlist) {
				sectionlist.getSection().expand();
				sectionlist.getSection().filterSearch(query);
			});
		} else {			
			self.filterReset();
		}
		
		self.sections_states_searching = false;
		if (self.sections_states_searching_queue) {
			self.onFilterSearch();
		}
	},
	
	filterReset: function() {		
		var self = Enjin_Messaging_Tray;
				
		self.el_filter_panel.find('.icon').removeClass('search');
		self.filterRestoreState();
		self.sections_states_saved = false;
		self.sections_states = {};
		
		for (var i=0; i<self.default_sections.length; i++) {
			self.default_sections[i].filterReset();
		}
		
		$.each(self.sections, function(site_id, section) {
			section.getSection().filterReset();
		});		
		
		self.sections_states_searching = false;
		self.sections_states_searching_queue = false;
	},
	
	/* filter state part */
	filterSaveState: function() {
		var self = this;
		var hash;
		
		this.sections_states = {};
		
		
		for (var i=0; i<this.default_sections.length; i++) {
			hash = "default_"+i;
			this.sections_states[hash] = {section: this.default_sections[i], expanded: this.default_sections[i].isExpanded()};
		}
		
		$.each(self.sections, function(site_id, sectionlist) {
			self.sections_states["site_"+site_id] = {section: sectionlist.getSection(), expanded: sectionlist.getSection().isExpanded()};
		});		
	},
	
	filterRestoreState: function() {
		$.each(this.sections_states, function(hash, data) {
			if (data.expanded)
				data.section.expand();
			else
				data.section.shrink();
		});
	},
	
	/* chat part */
	
	/**
	 * Show anchors for channels that are flagged as open in tray, we just flag it here are we must
	 * not create a empty tray for persistent channels, but we only know which channels are persisted
	 * once the loading is complete, so we flag the channels to open and actually open them in _initPersistent
	 */
	showChatChannelOptionTray: function(data) {
		if ( typeof this.channels_to_open === 'undefined' ) {
			this.channels_to_open = [];
		}
		this.channels_to_open.push(data);
	},
	
	_showChatChannelOptionTray: function() {
	    /* this will show the channels which have the setting to show, and only if is not in persistent */
		if ( typeof this.channels_to_open !== 'undefined' ) {
			for ( var i = 0; i < this.channels_to_open.length; i++ ) {
				var data = this.channels_to_open[i];
				var hash = this.getChatHashChannel(data.preset_id);
				if (typeof this.persistent_chats[hash] === 'undefined') {
					this.joinChatChannel(data.preset_id, data.name, data.count, {show_in_tray: true});
				}	
			}		
		}		
	},
	
	joinChatChannel: function(preset_id, name, total, options) {
	    if (!options)
	       options = {};
	    
	    //just in case
	    Enjin_Messaging_Tray_Chatchannel.hideList();
	    
	    var channel = this.getChatChannel(preset_id);
	    if (channel != null) {
	        this.showChatChannel(preset_id);
	    } else {
	        if (options.show_in_tray) {
	            this.startChatChannel(preset_id, name, total, {fulldisplay: false, show_in_tray:true});
	        } else {
        		var self = this;
        		Enjin_Messaging_Pusher.addChatChannel(preset_id, function() {
        			self.startChatChannel(preset_id, name, total, {fulldisplay: true});
        			self.hideUserList();
        		});
        	}
    	}
	},
	
	
	startChatChannel: function(preset_id, name, total, options) {
		var el = this.getChatChannel(preset_id);
		var show = options.fulldisplay;
		if (!el) {
			this.createChatChannelElements(preset_id);
			el = this.getChatChannel(preset_id);
		} else {
			show = !el.anchor.isMinimized();
		}
		
		if (show) {
			this.showChatChannel(preset_id);
		}

		if (!options.show_in_tray) {
			this.persistChatChannel(preset_id, show, name, total);
    	} else {
    	    el.anchor.mode_show_in_tray = true;
			el.anchor.open_tray = true;	// flag that the anchor must remain even when user leaves channel
    	    el.anchor.channelUpdateName(name);
    	    el.anchor.channelUpdateCount(total);
			el.anchor.channelHideX();
    	}
    	
		this.anchor_chatchannels_index++;
		this.setOffsetActive(); //update if needed
		
		return el;
	},
	
	persistChatChannel: function(preset_id, show, name, total) {
		var hash = this.getChatHashChannel(preset_id);
		if ( typeof this.persistent_chats[hash] === 'undefined' ) {
			this.persistent_chats[hash] = {
						type: 'chatchannel', 
						v: 'v2', 
						preset_id: preset_id, 
						show: show ? 1 : 0, 
						name: name,
						total: total+1,
						index: this.anchor_chatchannels_index
					};
		} else {
			this.persistent_chats[hash].show = show ? 1 : 0;
		}
		
	   this.persistentSaveWindows();	
	},
	
	updateChatChannelInfo: function(preset_id, name, total) {
	    if (total == '' || name == '')
	       return;
	       
	   var hash = this.getChatHashChannel(preset_id);
	   
	   if (this.persistent_chats[hash]) {
    	   this.persistent_chats[hash]['name'] = name;
    	   this.persistent_chats[hash]['total'] = total;
    	   this.persistentSaveWindows();
        }
	},
	
	createChatChannelElements: function(preset_id, index) {
		var anchor = Enjin_Messaging_Tray.createAnchorChatChannel({preset_id: preset_id, type: 'chat-channel'});
		var hash = Enjin_Messaging_Tray.getChatHashChannel(preset_id);
		var container = new Enjin_Messaging_Tray_ContainerChatChannel(preset_id, anchor); 
		
		this.chats[hash] = {
			type: 'chatchannel',
			preset_id: preset_id,
			anchor: anchor,
			container: container
		};
		
		this._createChatElements(hash, index, this.el_chatchannel_anchor);
	},
	
	toggleChatChannel: function(preset_id) {
		var self = this;
		var el = this.getChatChannel(preset_id);
		if (el) {
			if (el.container.visible()) {
				el.container.hide();
			} else {
		        var self = this; 
				Enjin_Messaging_Common_ContainerChatChannel_Static.addInstancePreset(el.container);
        		Enjin_Messaging_Pusher.addChatChannel(preset_id, function() {
        			self.persistChatChannel(preset_id, true, el.anchor.el.find('.name').text(), el.anchor.el_channel_count.text());
					self.showChatChannel(preset_id);
        		});
			}
		}
	},
			
	popupMinecraftPlayerInfo: function(player, server, host, port) {
        alert(player + ' is playing on server "' + server + '"\nYou can join them at: ' + host + ':' + port);
    },
	
	getContainerChatChannel: function(preset_id) {
		var channel = this.getChatChannel(preset_id);
		if (channel)
			return channel.container;
			
		return null;
	},
	
	/* load asm select if not loaded */
	loadAsmSelect: function(callback) {
		if (typeof $.fn.asmSelect == 'undefined') {
			$.getScript(Enjin_Messaging_Tray.resource_asmselect, function(script, textStatus, jqXHR) {
				callback.call();
			});
		} else {
			callback.call();
		} 
	},
	
	loadFileUploader: function(callback) {
	    if (typeof Enjin_Messaging_Tray.loadFileUploader['loadFileUploader'] != 'undefined')
	       return;
	    
	    Enjin_Messaging_Tray.loadFileUploader['loadFileUploader'] = true;
		if (typeof qq == 'undefined') {
			$.getScript(Enjin_Messaging_Tray.resource_fileuploader, function(script, textStatus, jqXHR) {
			    delete Enjin_Messaging_Tray.loadFileUploader['loadFileUploader'];
				callback.call();
			});
		} else {
		    delete Enjin_Messaging_Tray.loadFileUploader['loadFileUploader']; 
			callback.call();
		}
	},
	
	loadBBCodeScript: function(callback) {
        if (typeof MarkItUp == 'undefined' || typeof MarkItUp.BBCode == 'undefined') {
            var total_loaded = 0;
            function callbackFire() {
                total_loaded++;
                if (total_loaded == Enjin_Messaging_Tray.resource_bbcode.length)
                    callback.call();
                else {
                    $.getScript(Enjin_Messaging_Tray.resource_bbcode[total_loaded], function(script, textStatus, jqXHR) {
                        callbackFire();
                    });
                }
            }
            
            $.getScript(Enjin_Messaging_Tray.resource_bbcode[0], function(script, textStatus, jqXHR) {
                callbackFire();
            });
            
            //load css
            $("head").append("<link rel='stylesheet' type='text/css' href='"+Enjin_Messaging_Tray.resource_bbcode_css+"' />");
        } else {
            callback.call();
        } 
    },
	
	
	/* helper to generate proper "class"*/
	createAnchorUser: function(params) {
	    var base = new Enjin_Messaging_Tray_Container_Anchor_Common(params);
	    var extended = new Enjin_Messaging_Tray_Container_Anchor_User();
	    var extended = $.extend(true, base, extended); //extend class
	    extended.initExtended();
	    
	    return extended;
	},
	
	createAnchorChatChannel: function(params) {
        var base = new Enjin_Messaging_Tray_Container_Anchor_Common(params);
        var extended = new Enjin_Messaging_Tray_Container_Anchor_ChatChannel();
        var extended = $.extend(true, base, extended); //extend class
        extended.initExtended();
        
        return extended;
    } 
};
;

// js file: themes/core/js/modules/messagingchat.site.container.js


Enjin_Messaging_Site_Container = function(preset_id, options) {
    this.init(preset_id, options);
}

Enjin_Messaging_Site_Container.__prepared = false;
Enjin_Messaging_Site_Container.prepare = function() {
    if (!Enjin_Messaging_Site_Container.__prepared && typeof Enjin_Messaging_Common_ContainerChatChannel != 'undefined') {
        Enjin_Messaging_Site_Container.__prepared = true;
        $.extend(Enjin_Messaging_Site_Container.prototype, Enjin_Messaging_Common_ContainerChatChannel);
    }
}

Enjin_Messaging_Site_Container.joinChat = function(el) {
    var instance = Enjin_Messaging_Common_ContainerChatChannel_Static.getInstanceBelongingEl(el);
    if (!instance) {
        //create instance and join
        var preset_id = $(el).closest('.chat-container-channel').attr('data-channelid');
        instance = new Enjin_Messaging_Site_Container(preset_id, {
            channel_joined: false
        }); 
        instance.hideGhost();
    }        
    
    instance.joinChat();       
}

/* call to this function if join is from tray */
Enjin_Messaging_Site_Container.joinedTrayChat = function(preset_id) {
    var els = $('.m_messagingchat[data-channelid='+preset_id+']');
    els.each(function(){
        //pick a child and join to chat
        Enjin_Messaging_Site_Container.joinChat($(this).find('.wrapper-content'));
    });
}

Enjin_Messaging_Site_Container.prototype =  {
    preset_id: null,
    options: null,  
    el: null,
    el_text: null,
    el_anchor: null,
    el_messages: null,
    el_messages_scrollbar: null,
    el_users: null,
    el_separator: null,
    loading: null,
    is_logged: false,
    
    /*actions*/
    el_actions_smileys: null,
    el_actions_sound: null,
    
    uploader: null,
    
    admin_acls_access: null,
    admin_banned_row_template: null,    
    
    can_moderate: null,
    is_muted: null,
    user_kicked: null,
    acceptingCalls: false,
	
    init: function(preset_id, options) {
        this.is_logged = options.channel_joined;
		
		// don't do anything if the messaging bundle has not been loaded, which is currently
		// the case when there is olnly a guest user browsing
		if ( typeof this.commonInit !== 'function' ) {
			return;
		}
        this.commonInit(preset_id, options);
        
        if (options.popup_admin)
            Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance(options.popup_admin); 
                    
        if (options.popup_user)
            Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance(options.popup_user); 

        
        //prepare el
        this.el = $('.m_messagingchat[data-channelid='+preset_id+']');        
                
        if (options.is_banned) {
            this.showGhost('banned');
            return;
        }        

        this.is_muted = parseInt(options.is_muted);
        this.user_kicked = options.user_kicked;   
        this.can_moderate = options.can_moderate;             
        
        this.prepareEl();
        this.commonPrepareEl();
        this.commonScrollBottom(false);
        
        // buttons
        this.el.chatMessageButtons();
        
        // pagination
        this.el.find('.content-messages-scrollbar').chatMessagePagination();
        
        //don't allow to make changes until fully connected
        var self = this;
        Enjin_Pusher.onReady(function() {
            self.el_text.attr('disabled', 'disabled');
			// don't subscribe the channel to recieve msgs, etc unless we are actually joined already, otherwise
			// msg pings etc will still be heard even though we are not on the channel
            if (self.is_logged) { 
				Enjin_Messaging_Pusher.addChatChannel(preset_id, self.onMessagingStart, self);
			}
        });
        
        //add users in json
        if (options.json_users) {
            for (var i=0; i<options.json_users.length; i++)
                Enjin_Messaging_Common_ContainerChatChannel_UserStore.add(self.preset_id, options.json_users[i]);
        }
		
		this.total_online = options.total;
        this.commonUpdateCount();
		
        if (!this.is_logged)
            this.showGhost('join');            
    },
    
    prepareEl: function() {
        this.el_settings = this.el.find('.wrapper-settings');

        //this is a bit hack, but we need to set an explicit width to avoid large text to break html
        //var total_width = this.el.closest('.module_content').innerWidth();
        //this.el.css('width', total_width);
        
        this.el.show(); //need to show before to know the width

        var border = this.el.find('.wrapper .content-messages-container').innerWidth() - this.el.find('.wrapper .content-messages-container').width();
        this.el.find('.wrapper .content-messages-container').css('width', this.el.find('.content-messages-scrollbar').width() - border - 20);
    },
    
    onMessagingStart: function() {
        this.el_text.removeAttr('disabled');
        this.acceptingCalls = true;  
    },
    
    onLeaveChat: function() {
        this.is_logged = false;
    },
    
    joinChat: function() {
        var self = this;
        var preset_id = self.preset_id;

        var data = {
            cmd: 'chat-channel-join',
            preset_id: preset_id,
            use_module: true
        };

		// let the user know that something is happening ....
		this.showGhost('working', 'Joining channel...');
		
        $.post('/ajax.php?s=messagingchat', data, function(response) {
            //this is a bit of hack, just extract the messages and user list
            if (response.error && response.error != '') {
                Enjin_Messaging_Common_ContainerChatChannel_Static.leaveChat(preset_id);
                
                if (response.banned_popup) {                    
                    //@todo change
                    //Enjin_Core.Notifications.addGrowl("growl-chat-channel-banned", response.banned_popup);
                } else {
                    //Enjin_Core.alert(response.error); //disabled per request of ENJINCMS-4401
                }
                
                self.onLeaveChat();
            } else {            
                self.is_muted = parseInt(response.is_muted);
                self.user_kicked = response.user_kicked;   
                self.can_moderate = response.can_moderate;      
				
				self.total_online = response.count;
				for (var i=0; i<response.json_users.length; i++) {
                    Enjin_Messaging_Common_ContainerChatChannel_UserStore.add(self.preset_id, response.json_users[i]);
                }
                
                self.el.replaceWith(response.html);
                
                //update var references to new dom 
                self.el = $('.m_messagingchat[data-channelid='+preset_id+']');
                self.prepareEl();
                self.commonPrepareEl(); 
                self.commonScrollBottom(false);
				self.commonUpdateCount();
                
                // buttons
                self.el.chatMessageButtons();
                
                // pagination
                self.el.find('.content-messages-scrollbar').chatMessagePagination();
				
                //@todo common handling                
                if (response.html_popup != '')
                    Enjin_Messaging_Tray_ContainerChatChannel_AdminPopups.getInstance(response.html_popup); //prepare instance
                    
                if (response.html_userpopup != '')
                    Enjin_Messaging_Tray_ContainerChatChannel_UserPopups.getInstance(response.html_userpopup); //prepare instance
                    
                //enable box
                self.hideGhost();       
				
				// join the pusher channel to receive notifications
				Enjin_Messaging_Pusher.addChatChannel(preset_id, self.onMessagingStart, self);
            }
        }, 'json');
    },
    
    hostOnLeaveChat: function(response, extra) {
        this.acceptingCalls = false;
        this.onLeaveChat();
        
        if (!extra || (extra.type != 'banned' && extra.type != 'kicked'))
            this.showGhost('join');
            
        this.commonRemove(); //disconnect
    },
    
    hostUpdateCount: function(total) {
        //NOP
    },
    
    hostAddNotification: function() {
       //NOP
    },
    
    hostClearNotifications: function() {
        //NOP
    },
    
    hostSetNameDOM: function(value) {
        //NOP
    },
    
    hostChannelBanned: function(data) {
        var el = $(data.html_user_popup).find('.scontent')
        var message_box = this.el.find('.ghost-box .message-banned .inner');
        
        message_box.empty();
        el.appendTo(message_box);
        this.clearChatData();
        this.showGhost('banned');
    },  
    
    hostChannelKicked: function(data) {
        var el = $(data.html_user_popup).clone();
        this.el.find('.ghost-box .message-kicked').remove();
        
        el.removeClass();
        el.addClass('inner');
        
        var nel = $('<div class="mchatmessage-box message-kicked element_popup"></div>');
        nel.append(el);
        
        //also change link as is not the same
        el.find('.rejoin-link a').get(0).onclick = function() { Enjin_Messaging_Site_Container.joinChat(this); }
        
        nel.appendTo(this.el.find('.ghost-box .wrapper-middle'));
        this.clearChatData();
        this.showGhost('kicked');
    },  
    
    clearChatData: function() {
        this.el_messages.empty();
        this.el_users.empty();
    },
    
    hideGhost: function()  {
        this.el.find('.ghost-box').hide();
    },
    
    showGhost: function(type, text) {
        this.el.find('.ghost-box .mchatmessage-box').hide();        
        this.el.find('.ghost-box .message-'+type).show();
		
		// if a special text value was given, replace the 'text' element with the given string
		if ( typeof text !== 'undefined' ) {
			this.el.find('.ghost-box .message-'+type+' .text').html(text);
		}
		
        this.el.find('.ghost-box').show();
        this.el.show(); //just in case show main
    },
    
    hostShowSettings: function() {
        //create popup and later move dom into this
        var popup_width = 700;
                
        var el = $('<div />');
        el.addClass('element_popup');
        el.addClass('m_messagingchat_settings');
        el.css('width', popup_width);
        
        //center popup
        el.css('top', $(window).scrollTop() + 100);
        el.css('left', ($(document.body).width() - popup_width)*0.5);
        
        el.append('<div class="inner"><div class="chat-container-channel chat-container-channel-settings" data-channelid="'+this.preset_id+'"></div></div>');
        
        var chat_container_fake = el.find('.chat-container-channel').get(0);
        chat_container_fake.rel_el = this;
        
        $(document.body).append(el);
        this.el_settings.show();
        el.find('.inner .chat-container-channel').append(this.el_settings);
        
        //create separator
        Enjin_Core.createPopupSeparator();
        Enjin_Core.placeAfterPopupSeparator(el);
    },
    
    hostCloseSettings: function() {
        //remove separator and popup
        var popup = $('.chat-container-channel-settings[data-channelid='+this.preset_id+']').closest('.element_popup');
        
        console.log("FOUND: ", this.preset_id, popup.length);
        
        //reattach to main node
        this.el.children('.wrapper').append(this.el_settings);
        this.el_settings.hide();
        popup.remove();
        Enjin_Core.removePopupSeparator();
    }
}


;

// js file: themes/core/js/modules/messagingchat.js

$(document).ready(function(){
    
    // resize the chat dimensions when resizing the window
    $(window).on('resize', function(){
        // only do this for the popup
        if ('messagingchat_popup' !== window.name) {
            return;
        }
        
        // 20px is the 10px padding of the left and right window; also remove the hard coded width of the module container
        var container = $('.module_content').css('width', $(this).width() - 20).find('.m_messagingchat').css('width', '');
        var height = $(this).height() - 30 - 20;    // 30px is the header, 20px is the top padding
        container.find('.content').height(height);
        container.find('.content-messages').height(height - 35);
    });
});


// message pagination
$.fn.chatMessagePagination = function(){
    $(this).bind('scroll', function(){
        var container = $(this);
        if (container.scrollTop() === 0) {
            var pagination_container = container.find('.message_pagination');
            if (pagination_container.length) {

                // get the messages
                var url = pagination_container.attr('data-url');
                $.get(url, function(html){
                    pagination_container.parents('.messages_chunk:first').before(html);
                    pagination_container.remove();

                    // scroll to the bottom of the new messages
                    var chunk_height = container.find('.messages_chunk:first').height();
                    container.scrollTop(chunk_height - 30); // 30 is the height of the loading container
                });
            } else {
                container.find('.message_history_limit').show();
            }
        }
    });
};


// buttons
$.fn.chatMessageButtons = function(){

    // popout
    $(this).on('click', '.action.chat_popup', function(){
        var url = $(this).attr('data-url');
        var height = $(this).attr('data-height');
        window.open(url, 'messagingchat_popup', 'width=800,height=' + height);
    });

    // hover delete message
    $(this).on('mouseenter', '.message', function(){
        $(this).find('.message_delete.show_delete').show();
    }).on('mouseleave', '.message', function(){
        $(this).find('.message_delete.show_delete').hide();
    });

    // delete message
    $(this).on('click', '.message_delete', function(event){
        event.preventDefault();
        $.get($(this).attr('href'));
        $.fn.chatMessageDeleteMessage($(this).attr('data-user-id'), $(this).attr('data-created'));
    });
};


// delete a message
$.fn.chatMessageDeleteMessage = function(user_id, created){
    var id = '#message-' + user_id + '-' + created;
    $('.content-messages-container').find(id).remove();
};


// delete all user messages
$.fn.chatMessageDeleteUserMessages = function(user_id){
    var id = '.message-by-' + user_id;
    $('.content-messages-container').find(id).remove();
};
;
