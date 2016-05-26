"use strict";
import unit from './unit';
import FEATURES from './features';

const quote = JSON.stringify.bind(JSON);

const uc = (v = '')=> {
    return v[0].toUpperCase() + v.substring(1);
};

const ucc = (v)=> {
    return v.split('-').map(uc).join('');
};

const camel = (arg, ...args)=> {
    const [a, ...rest] = arg.split('-');
    return [a, ...rest.map(ucc), ...args.map(ucc)].join('');
};

const vendorIf = (vendor, str)=> {
    if (vendor) {
        return `if (vendor === ${JSON.stringify(vendor)}){\n${str}\n}`;
    }
    return str;
};

const rhsunit = (u)=> {
    const un = unit(u);
    let ret;
    if (un && typeof un.value === 'number') {
        ret = un.unit ? `(${un.value} * units["${un.unit}"])` : un.value;
    } else {
        ret = quote(u);
    }

    return ret;
};


const rhs = (val)=> {
    if (typeof val === 'number' || typeof val == 'boolean') {
        return val;
    } else {
        return rhsunit(val);
    }
};

const isObjectLike = (value)=> {
    if (!value) return false;
    const tofv = typeof value;
    switch (tofv) {
        case 'string':
        case 'boolean':
        case 'number':
            return false;
    }
    if (value instanceof Date || value instanceof RegExp)return false;
    return true;
};

const pdecl = (root, type, values) => {
    if (!isObjectLike(values)) {
        const vvv = rhs(values);
        return `${root}.${camel(type)} = ${vvv}`;
    }
    return Object.keys(values).reduce((str, key)=> {
        const v = values[key];
        if (!isObjectLike(v)) {
            return `${str}\n ${root}.${camel(type, key)} = ${rhs(v)}`;
        } else if (Array.isArray(v)) {
            return `${str}\n ${root}.${camel(type, key)} = ${v.map(rhs).join(',')}`;
        } else if (typeof v === 'object') {
            return Object.keys(v).reduce((ret, kv)=> {
                return `${str}\n  ${root}.${camel(type, key, kv)} = ${rhs(v[kv])}`;
            }, str);
        } else {
            console.log('wtf?', v);
        }
        return str;
    }, '');
};

const writeCSS = (css) => {
    return Object.keys(css).map((key)=> {
        const base = `css[${JSON.stringify(key)}]`;
        const decls = css[key];
        return decls.reduce((str, decl)=> {
            const declStr = vendorIf(decl.vendor, `${pdecl(base, decl.type, decl.values)}`);
            return `\n${str}\n${declStr}`
        }, `if(!${base}) ${base} = {};\n`);
    }).join(';\n')
};


const writeExpression = (expr)=> {
    return `\t(FEATURES['${expr.modifier ? expr.modifier + '-' : ''}${expr.feature}'] && FEATURES['${expr.modifier ? expr.modifier + '-' : ''}${expr.feature}']( ${rhsunit(expr.value)}, config ))\n`;
};

const writeRule = (rule)=> {
    const expr = rule.expressions.map(writeExpression).join(' && ');

    return rule.inverse ? `!(${expr})` : expr;
};

const writeSheet = ({rules=[], css}, idx) => {
    let str = '';
    if (rules && rules.length) {
        str += `if (${rules.map(writeRule).join(' && ')}){\n${writeCSS(css)}\n}`;
    } else {
        str += `${writeCSS(css)}`;
    }
    return str;
};

export const source = (sources)=> {
    return `
const css = {};
const px = 1, 
      vendor = config.vendor,
      inch = 96,
      vh = config.height / 100,
      vw = config.width / 100, 
      units = {
      px : px,
      vh : vh,
      vw : vw,
      'in':inch, 
      pt:(inch/72), 
      em:1, 
      pc:12 * (inch/72),
      vmin:Math.min(vw, vh),
      vmax: Math.max(vw, vh)
};
${sources.map(writeSheet).join('\n')}
            
return css;        
        `
};

export default function compile(sources) {
    const src = source(sources);
    try {
        var f = new Function(['FEATURES', 'config'], src);
        f._source = src;
        return f;
    } catch (e) {
        console.log('source', src, '\n\n', e.stack + '');
        throw e;
    }
}