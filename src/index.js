function getSegments(path) {
  const pathType = typeof path;
  let segments;

  if (pathType === "string") {
    if (!path.length) {
      return [];
    }

    segments = path.split(".");
  } else {
    segments = path.map(seg => {
      const segType = typeof seg;
      if (segType === "string" || segType === "number") {
        return seg;
      }

      if (segType === "function") {
        return seg();
      }
    });
  }

  return segments;
}

function equalArrays(a, b) {
  return a.length == b.length && a.every((v, i) => v === b[i]);
}

const PTree = function (_root) {

  if (typeof _root !== "object") {
    throw "PTree: Constructor received atomic value as root";
  }

  this._root = _root;

  // Get value at path
  this.get = function (path) {
    const pathType = typeof path;
    if (pathType !== "string" && !Array.isArray(path)) {
      throw `PTree: String or Array expected, received: ${pathType}`;
    }

    if (this._root[path] !== undefined) {
      return this._root[path];
    }

    let segments = getSegments(path);

    // Iterative deep object descent
    let obj = this._root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      obj = obj[seg];

      if (obj === undefined) {
        return undefined;
      }
    }

    return obj;
  }

  // Get key paths recursively
  this.keys = function (prev) {
    const objType = typeof this._root;
    if (objType !== "object" && !Array.isArray(this._root)) {
      throw `PTree: Object or Array expected, received: ${objType}`;
    }

    let keys = [];

    if (objType === "object" && !Array.isArray(this._root)) {
      let props = Object.keys(this._root);
      keys = props.reduce((acc, key) => {
        const v = this._root[key];
        if (typeof v === "object") {
          return acc.concat(new PTree(v).keys(key));
        }
        return acc.concat(key);
      }, []);
    } else if (Array.isArray(this._root)) {
      keys = this._root.reduce((acc, v, i) => {
        if (typeof v === "object") {
          return acc.concat(new PTree(v).keys(i.toString()));
        }
        return acc.concat(i.toString());
      }, []);
    } else {
      throw `Tried to get keys of atomic value`;
    }

    if (prev !== undefined) {
      keys = keys.map(k => `${prev}.${k}`)
    }

    return keys;
  }

  // Set value at path
  this.set = function (path, value) {
    const pathType = typeof path;
    if (pathType !== "string" && !Array.isArray(path)) {
      throw `PTree: String or Array expected, received: ${pathType}`;
    }

    let segments = getSegments(path);

    // Iterative deep object descent & set
    let obj = this._root;

    for (let i = 0; i < segments.length; i++) {
      const current = obj;
      const seg = segments[i];

      if (i < segments.length - 1) {
        obj = obj[seg];
      } else {
        if (typeof obj === "object") {
          obj[seg] = value;
        } else {
          throw `PTree: Tried to set property of atomic value`;
        }
      }

      if (obj === undefined) {
        if (/^[0-9]+$/.test(seg))
          current[seg] = [];
        else
          current[seg] = {};
        obj = current[seg];
      }
    }
  }

  // Get all values as array
  this.values = function () {
    return this.fromKeys(this.keys());
  }

  // Get all values from an array of keys
  this.fromKeys = function (keys) {
    return keys.map(k => this.get(k));
  }

  // Get all keys where a certain condition is true
  this.filterKeys = function (filter) {
    return this.keys().filter(k => filter(this.get(k)));
  }

  // Flatten object
  this.flatten = function () {
    let flat = {};

    this.keys().forEach(key => {
      flat[key] = this.get(key);
    });

    return flat;
  }

  // Compare
  this.equal = function (other) {
    if (typeof this._root !== typeof other)
      return false;

    const otherTree = new PTree(other);

    const keys = this.keys();
    const otherKeys = otherTree.keys();

    if (!equalArrays(keys, otherKeys))
      return false;

    const values = this.fromKeys(keys);
    const otherValues = otherTree.fromKeys(otherKeys);

    return equalArrays(values, otherValues);
  }

  // Find key where condition is met
  this.findKey = function (finder) {
    return this.keys().find(k => {
      return finder(this.get(k));
    });
  }

  // Maps all keys to new values (returns new object/array)
  this.map = function (mapper) {
    const keys = this.keys();
    let mapped;

    if (Array.isArray(this._root)) {
      mapped = [];
    } else if (typeof this._root === "object") {
      mapped = {};
    }

    let p = new PTree(mapped);

    keys.forEach(key => {
      let value = this.get(key);
      p.set(key, mapper(value));
    });

    return mapped;
  }

  // Validate object integrity
  this.validate = function (props) {
    for (const prop of props) {
      if (!prop.path) {
        throw "PTree: Invalid path in validation function";
      }

      if (prop.path === "*") {
        props.push(...this.keys().map(key => {
          return {
            path: key,
            optional: prop.optional,
            rules: prop.rules
          };
        }));
        continue;
      }

      const value = this.get(prop.path);

      if (value === undefined && !prop.optional) {
        return false;
      }

      if (value === undefined && prop.optional) {
        return true;
      }

      if (prop.rules) {
        for (const rule of prop.rules) {
          if (!rule(value))
            return false;
        }
      }
    }

    return true;
  }
}

module.exports = function (_root) {
  return new PTree(_root);
};