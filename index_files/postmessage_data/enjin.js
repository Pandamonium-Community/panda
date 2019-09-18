/* this will be readed from the messaging server */
Enjin_Messaging_Pusher_Child = {
	options: null,
	userId: null,
	
	init: function(options) {
		this.options = options;
		this.options.callback_url = unescape(this.options.callback_url);
		
		var callback_url = this.options.callback_url;
		
		var postmessage_fn = function(e) {
			//check if have valid origin
			if (e.origin == callback_url) {
				var json = eval('('+e.data+')');
				var calltype = json.calltype;
				delete json.calltype;
				
				if (calltype == 'traySaveChats') {
					Enjin_Messaging_Pusher_Child.saveChatWindows(json.chats);
				} else if (calltype == 'traySaveChatHistory') {
					Enjin_Messaging_Pusher_Child.saveChatContainer(json.hash, json.data);
				} else if (calltype == 'trayClearChatHistory') {
					Enjin_Messaging_Pusher_Child.clearChatContainer(json.hash);
				} else if (calltype == 'traySaveSiteInfo') {
					Enjin_Messaging_Pusher_Child.saveSiteInfo(json.site_id, json.data);
				} else if (calltype == 'traySaveSectionState') {
					Enjin_Messaging_Pusher_Child.saveSectionState(json.hash, json.data);
				} else if (calltype == 'persistentChatRemove') {
					Enjin_Messaging_Pusher_Child.persistentChatRemove(json.hash);
				} else if (calltype == 'traySaveChatChannel') {
					Enjin_Messaging_Pusher_Child.saveChatContainer(json.hash, json.data);
				} else if (calltype == 'trayClearChatChannel') {
					Enjin_Messaging_Pusher_Child.clearChatContainer(json.hash);					
				}
			}
		};
		
		if (window.addEventListener)
			window.addEventListener('message', postmessage_fn, false);
		else
			window.attachEvent('onmessage', postmessage_fn, false);
		
		//start window
		this.userId = this.options.userId;
		this.initUser();
	},
	
	sendPostMessage: function(data) {
		var data_json = JSON.stringify(data);
		parent.postMessage(data_json, this.options.callback_url);
	},		
	
	/* check below */
	initUser: function() {
		var userId = Enjin_Messaging_Pusher_Child.userId;
		
		//check if current data is from userId, if not discard
		var pUserId = $.jStorage.get("emtpcUserId") || 0;
		var users = [];
		//var users_offline = [];
		var persistent_chats = $.jStorage.get("emtpcPersistentChats") || {};
		var chat_history = {}; 
		var i;
		var indexes;
		var index;
		
		if (pUserId != userId) {
			//reset all chats
			indexes = $.jStorage.index();
			
			//clear everything
			for (i=0; i<indexes.length; i++) {
				index = indexes[i];
				if (index.substr(0, 5) == 'emtpc')				
					$.jStorage.deleteKey(index);
			}
			
			$.jStorage.set("emtpcUserId", userId);
			$.jStorage.set("emtpcPersistentChats", {});
			
			persistent_chats = {};
		}
		
		//load chat history
		var _save_persistent = false;
		var retrieveItem = function(keyHash) {
			var key = Enjin_Messaging_Pusher_Child.persistentChatContainerGetKey(keyHash);
			var item = $.jStorage.get(key) || null;
			if (item) {
				chat_history[keyHash] = item;
			}
		}
		
		var npc = {};
		jQuery.each(persistent_chats, function(keyHash, value) {
			if (typeof value['v'] == 'undefined')
				value.v = 'v1';
			
			if (value.v == 'v1') {
				_save_persistent = true;
				
				var key = Enjin_Messaging_Pusher_Child.persistentChatContainerGetKey(keyHash);
				var item = $.jStorage.get(key) || null;
				if (item) {
					//clear previous entry
					Enjin_Messaging_Pusher_Child.clearChatContainer(keyHash);
					
					var newKeyHash = "user_"+keyHash;
					item.v = 'v2';
					item.type = 'user';
					Enjin_Messaging_Pusher_Child.saveChatContainer(newKeyHash, item);
					
					chat_history[newKeyHash] = item;
					npc[newKeyHash] = value;
				} else {
					retrieveItem(keyHash); //fallback
				}
			} else {
				retrieveItem(keyHash);
			}			
		});
		
		if (_save_persistent) {
			persistent_chats = npc;
			Enjin_Messaging_Pusher_Child.saveChatWindows(npc);
		}
		
		//states		
		var sections_state = {};
		var indexes = $.jStorage.index();
		
		//clear everything
		for (i=0; i<indexes.length; i++) {
			index = indexes[i];
			if (index.substr(0, 12) == 'emtpcSection') {				
				var dataitem = $.jStorage.get(index);
				sections_state[dataitem.hash] = dataitem;
			}
		}
		
		
		Enjin_Messaging_Pusher_Child.sendPostMessage({
			component: 'etmpc',
			method: 'renderFriendsPusher',
			data: {
				chats: persistent_chats,
				chat_history: chat_history,
				sections: sections_state
			}
		});
	},
	
	saveChatWindows: function(chats) {
		$.jStorage.set("emtpcPersistentChats", chats);
	},
	
	persistentChatRemove: function(keyHash) {
		var pchats = $.jStorage.get("emtpcPersistentChats") || {};
		delete pchats[keyHash];
		
		$.jStorage.set("emtpcPersistentChats", pchats);
	},
	
	//part for chat container
	persistentChatContainerGetKey: function(keyHash) {
		return 'messagingtray-chatcontainer-'+keyHash;
	},
	
	saveChatContainer: function(keyHash, data) {
		var key = this.persistentChatContainerGetKey(keyHash);
		$.jStorage.set(key, data);
	},
	clearChatContainer: function(keyHash) {
		var key = this.persistentChatContainerGetKey(keyHash);
		$.jStorage.deleteKey(key, null);
	},
	
	saveSiteInfo: function(siteId, data) {
		Enjin_Core_Storage_Cache.set('emtpcSitesData-'+siteId, data, 43200); //cache for a day at least
	},
	
	saveSectionState: function(hash, data) {
		data.hash = hash;
		$.jStorage.set('emtpcSection-'+hash, data);
	}	
} 