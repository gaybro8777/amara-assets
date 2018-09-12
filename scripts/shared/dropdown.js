/*
 * Amara, universalsubtitles.org
 *
 * Copyright (C) 2018 Participatory Culture Foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see
 * http://www.gnu.org/licenses/agpl-3.0.html.
 */

var $ = require('jquery');
var keyCodes = require('./keyCodes');
var position = require('./position');

// Create a jquery plugin to handle dropdown stuff.  API:
//
//   - $(elt).dropdown(): initialize dropdown code (not needed if you add the .dropdownMenu class)
//   - $(elt).dropdown('show'): show the dropdown
//   - $(elt).dropdown('hide'): hide the dropdown
//   - $(elt).dropdown('toggle'): toggle the dropdown
//   - $(elt).dropdown('focusFirstLink'): focus the first link
//   - $(elt).dropdown('focusLastLink'): focus the last link
//   - In general, you can call any method of the DropDownMenu class.
// 
$.fn.dropdown = function(action) {
    if(action === undefined) {
        return this.each(setupDropdownMenu);
    } else {
        var extraArgs = Array.prototype.slice.call(arguments, 1);
        return this.each(function() {
            var dropdown = $(this).data('dropdown');
            var method = dropdown[action];
            if(method) {
                method.apply(dropdown, extraArgs);
            } else {
                throw "Unknown dropdown action: " + action;
            }
        });
    }
}

$.behaviors('.dropdownMenu', setupDropdownMenu);
$.behaviors('.dropdownMenu-button', dropdownMenuButton);

function dropdownMenuButton(button) {
    var button = $(button);
    var menu = $();

    if(button.data('target')) {
        menu = $('#' + button.data('target'));
        button.data('menu', menu);
    }

    button.click(function(evt) {
        menu.dropdown('toggle', button);
        evt.preventDefault();
    }).keydown(function(evt) {
        if(evt.which == keyCodes.enter ||
                evt.which == keyCodes.space ||
                evt.which == keyCodes.down) {
            menu.dropdown('show', button);
            menu.dropdown('focusFirstLink');
        } else if(evt.which == keyCodes.up) {
            menu.dropdown('show', button);
            menu.dropdown('focusLastLink');
        } else if(evt.which == keyCodes.esc) {
            menu.dropdown('hide');
        }
        evt.stopPropagation();
        evt.preventDefault();
    }).on('key-activate', function(evt) {
        menu.dropdown('show', button);
        menu.dropdown('focusFirstLink');
    });
}

function setupDropdownMenu(menu) {
    menu = $(menu);
    if(!menu.data('dropdown')) {
        menu.data('dropdown', new DropDownMenu(menu));
    }
}

function DropDownMenu(menu) {
    this.menu = menu;
    this.links = $('.dropdownMenu-link', menu).not('.disabled'),
    this.shown = false;
    this.openerButton = null;
    this.setupEventHandlers();
}

DropDownMenu.prototype = {
    show: function(button) {
        if(this.shown) {
            if(button == this.openerButton) {
                return;
            } else {
                this.hide();
            }
        }
        // hide all other menus;
        $('.dropdownMenu:visible').not(this.menu).dropdown('hide');
        position.below(this.menu, button);
        this.menu.css('display', 'flex');
        button.attr('aria-expanded', 'true');
        this.openerButton = button;
        this.shown = true;
    },
    hide: function() {
        if(!this.shown) {
            return;
        }
        this.menu.css('display', 'none');
        this.openerButton.attr('aria-expanded', 'false');
        this.openerButton = null;
        this.shown = false;
    },
    toggle: function(button) {
        if(this.shown && this.openerButton === button) {
            this.hide();
        } else {
            this.show(button);
        }
    },
    focusedLinkIndex: function() {
        var link = this.links.filter(':focus');
        if(link.length > 0) {
            return this.links.index(link);
        } else {
            return -1;
        }
    },
    focusFirstLink: function() {
        this.links.get(0).focus();
    },
    focusLastLink: function() {
        this.links.get(-1).focus();
    },
    focusNextLink: function() {
        var index = (this.focusedLinkIndex() + 1) % this.links.length;
        this.links.get(index).focus();
    },
    focusPrevLink: function() {
        var index = this.focusedLinkIndex() - 1;
        this.links.get(index).focus();
    },
    focusNextLinkWithChar: function(character) {
        var startingIndex = i = this.focusedLinkIndex();
        while(true) {
            i = (i + 1) % this.links.length;
            if(i == startingIndex) {
                return;
            }
            var currentLink = this.links.eq(i);
            if(currentLink.text().trim()[0].toUpperCase() == character) {
                currentLink.focus();
                return;
            }
        }
    },
    setupEventHandlers: function() {
        var self = this;

        this.links.on('keydown', function(evt) {
            if(evt.which == keyCodes.up) {
                self.focusPrevLink();
            } else if (evt.which == keyCodes.down) {
                self.focusNextLink();
            } else if(evt.which == keyCodes.enter) {
                self.activateLink(evt, $(this));
            } else if(evt.which == keyCodes.esc) {
                var button = self.openerButton;
                self.hide();
                self.focusButton(button);
            } else if(evt.which == keyCodes.home) {
                self.focusFirstLink();
            } else if(evt.which == keyCodes.end) {
                self.focusLastLink();
            } else if(keyCodes.isAlpha(evt.which)) {
                self.focusNextLinkWithChar(String.fromCharCode(evt.which));
            }

            evt.stopPropagation();
            evt.preventDefault();
        }).on('click', function(evt) {
            self.activateLink(evt, $(this));
        });
    },
    activateLink: function(evt, link) {
        var button = this.openerButton;
        this.hide();
        if(link.data('activateArgs')) {
            // dropdown-js-item -- trigger link-activate
            this.focusButton(button);
            this.menu.trigger('link-activate', link.data('activateArgs'));
            evt.preventDefault();
        } else {
            // Regular link item.  Don't call preventDefault() to make the link
            // click go through.  Also, skip calling focusButton, since that would
            // stop the click.
        }
    },
    focusButton: function(button) {
        var rv = this.menu.triggerHandler('focus-button');
        if(rv !== false) {
            button.focus();
        }
    }
};
