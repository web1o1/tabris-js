(function() {

  tabris.registerWidget("CollectionView", {

    _type: "tabris.CollectionView",

    _supportsChildren: function(child) {
      return child instanceof tabris.Cell;
    },

    _properties: {
      itemHeight: {
        type: "function|natural",
        default: 0,
        set: function(value) {
          if (typeof value !== "function") {
            // Required for 1.0 compatibility
            this._nativeSet("itemHeight", value);
          }
        }
      },
      items: {
        type: "array",
        set: function(value) {
          this._setItems(value);
        },
        get: function() {
          return this._items.concat();
        },
        nocache: true
      },
      initializeCell: {default: null},
      cellType: {
        type: "string|function",
        default: null,
        set: function() {}
      },
      refreshEnabled: {type: "boolean", default: false},
      refreshIndicator: {type: "boolean", default: false},
      refreshMessage: {type: "string", default: ""}
    },

    _create: function() {
      this._items = [];
      var result = tabris.Proxy.prototype._create.apply(this, arguments);
      this._nativeListen("requestinfo", true);
      this._nativeListen("createitem", true);
      this._nativeListen("populateitem", true);
      // TODO call _reload on flush
      this._reload();
      return result;
    },

    set: function() {
      var result = tabris.Proxy.prototype.set.apply(this, arguments);
      // TODO call _reload on flush, remove override
      this._reload();
      return result;
    },

    _events: {
      refresh: {
        trigger: function(event) {this.trigger("refresh", this, event);}
      },
      requestinfo: {
        trigger: function(event) {
          var item = this._getItem(this._items, event.index);
          var type = resolveProperty(this, "cellType", item);
          var height = resolveProperty(this, "itemHeight", item, type);
          var typeId = encodeCellType(this, type);
          this._nativeCall("describeItem", {index: event.index, type: typeId, height: height});
        }
      },
      createitem: {
        trigger: function(event) {
          var cell = tabris.create("Cell", {});
          cell._parent = this;
          this._addChild(cell);
          this._nativeCall("addItem", {widget: cell.cid});
          var initializeCell = this.get("initializeCell");
          if (typeof initializeCell !== "function") {
            console.warn("initializeCell callback missing");
          } else {
            initializeCell(cell, decodeCellType(this, event.type));
          }
        }
      },
      populateitem: {
        trigger: function(event) {
          var cell = tabris(event.widget);
          var item = this._getItem(this._items, event.index);
          cell.set("itemIndex", event.index);
          if (item !== cell.get("item")) {
            cell.set("item", item);
          } else {
            cell.trigger("change:item", cell, item, {});
          }
        }
      },
      select: {
        name: "selection",
        listen: function(state) {
          this._nativeListen("selection", state);
        },
        trigger: function(event) {
          var item = this._getItem(this._items, event.index);
          this.trigger("select", this, item, {index: event.index});
          this.trigger("selection", {index: event.index, item: item});
        }
      }
    },

    _setItems: function(items) {
      this._items = items || [];
      this._needsReload = true;
    },

    _getItem: function(items, index) {
      return items[index];
    },

    reveal: function(index) {
      index = this._checkIndex(index);
      if (index >= 0 && index < this._items.length) {
        this._nativeCall("reveal", {index: index});
      }
    },

    refresh: function(index) {
      if (arguments.length === 0) {
        this._nativeCall("update", {reload: [0, this._items.length]});
        return;
      }
      index = this._checkIndex(index);
      if (index >= 0 && index < this._items.length) {
        this._nativeCall("update", {reload: [index, 1]});
      }
    },

    insert: function(items, index) {
      if (!Array.isArray(items)) {
        throw new Error("items is not an array");
      }
      if (arguments.length === 1) {
        index = this._items.length;
      } else {
        index = Math.max(0, Math.min(this._items.length, this._checkIndex(index)));
      }
      Array.prototype.splice.apply(this._items, [index, 0].concat(items));
      this._adjustIndicies(index, items.length);
      this._nativeCall("update", {insert: [index, items.length]});
    },

    remove: function(index, count) {
      index = this._checkIndex(index);
      if (arguments.length === 1) {
        count = 1;
      } else if (typeof count === "number" && isFinite(count) && count >= 0) {
        count = Math.min(count, this._items.length - index);
      } else {
        throw new Error("illegal remove count");
      }
      if (index >= 0 && index < this._items.length && count > 0) {
        this._items.splice(index, count);
        this._adjustIndicies(index + count, -count);
        this._nativeCall("update", {remove: [index, count]});
      }
    },

    _reload: function() {
      // We defer the reload call until the end of create/set in order to ensure that
      // we don't receive events before the listeners are attached
      if (this._needsReload) {
        this._nativeCall("reload", {"items": this._items.length});
        delete this._needsReload;
      }
    },

    _checkIndex: function(index) {
      if (typeof index !== "number" || !isFinite(index)) {
        throw new Error("illegal index");
      }
      return index < 0 ? index + this._items.length : index;
    },

    _adjustIndicies: function(offset, diff) {
      var cells = this._children || [];
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var itemIndex = cell.get("itemIndex");
        if (itemIndex >= offset) {
          cell.set("itemIndex", itemIndex + diff);
        }
      }
    }

  });

  function resolveProperty(ctx, name) {
    var value = ctx.get(name);
    if (typeof value === "function") {
      return value.apply(null, Array.prototype.slice.call(arguments, 2));
    }
    return value;
  }

  function encodeCellType(ctx, type) {
    var cellTypes = ctx._cellTypes || (ctx._cellTypes = []);
    var index = cellTypes.indexOf(type);
    if (index === -1) {
      index += cellTypes.push(type);
    }
    return index;
  }

  function decodeCellType(ctx, type) {
    var cellTypes = ctx._cellTypes || [];
    return cellTypes[type];
  }

  tabris.registerWidget("Cell", {

    _type: "rwt.widgets.Composite",

    _supportsChildren: true,

    dispose: function() {
      console.warn("CollectionView cells are container-managed, they cannot be disposed of");
    }

  });

})();
