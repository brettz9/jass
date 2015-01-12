(function () {
//'use strict';

// Debugging
function j (s) {
    alert(JSON.stringify(s));
}

/**
* @private
* @static
*/
function _checkPreCSS3Grammar (options, props) {
    props.forEach(function (prop) {
        options[prop] = options[prop] === undefined ? (options.cssVersion && options.cssVersion < 3) : options[prop];
    });
}

/**
* JAvascript Style Sheets
* Format based on:
{@link http://www.w3.org/TR/CSS2/grammar.html#grammar},
{@link http://www.w3.org/TR/css3-namespace/#syntax},
{@link http://dev.w3.org/csswg/css-conditional/#media},
{@link http://dev.w3.org/csswg/css3-conditional/#at-supports}
{@link http://dev.w3.org/csswg/css-fonts/#font-face-rule},
{@link http://dev.w3.org/csswg/css-animations/#keyframes},
{@link http://dev.w3.org/csswg/css-page/#at-page-rule}
and
{@link http://w3c-test.org/csswg/mediaqueries3/#syntax}
* @requires shim: Array.prototype.forEach
* @todo Validate, e.g., url strings
* @todo: Finish rule and other nested conversions, including media queries' change of "term" production to support RESOLUTION (dpi, dpcm)
* @param {JSON} jass JASS structure
* @param {function} handlerObj Contains optional methods output, charset, imports, namespaces, rules
* @param {object} options Object currently supporting "features" property
* @returns {*|undefined} The output of the handlerObj.output method if present, and undefined if not.
*/
function JASS (jass, handlerObj, options) {
    if (!jass || typeof jass !== 'object') {
        throw 'Bad jass input';
    }
    options = options || {};
    _checkPreCSS3Grammar(options,
        ['noNamespaces', 'noMediaQueries', 'noConditionals', 'noKeyframes', 'noFontFace', 'noPageInMedia']
    );
    if (Array.isArray(jass)) {
        handlerObj.rules(jass, options);
    }
    else {
        // The subclasses should also have import, namespace, and rule methods
        ['charset', 'imports', 'namespaces', 'rules'
            // 'comments' // optional: whitespace and comment opening or closers before and between imports and between ruleset/media/page's,  (but apparently not comment text and HTML not CSS!) per http://www.w3.org/TR/CSS2/grammar.html ; reported as errata    
        ].forEach(function (method) {
            if (handlerObj[method] && jass[method]) {
                handlerObj[method](jass[method], options);
            }
        });
    }
    return handlerObj.output ? handlerObj.output() : undefined;
}

/**
* @todo Finish this CSSOM work
*/
function JASSCSSOMify () {

}
JASSCSSOMify.prototype.output = function () {return;};


function _repeat (ct, str) {
    return new Array(ct + 1).join(str || ' ');
}

/**
* @requires shim: Array.prototype.forEach
* @requires shim: Array.prototype.map
* @requires shim: Array.prototype.reduce
* @requires shim: Array.isArray
*/
function JASSStringifier (options) {
    this.str = '';
    options = options || {};
    this.indent = options.indent === undefined ? 4 : options.indent;
    this.indentChr = options.indentChr === undefined ? ' ' : options.indentChr; // Might wish, e.g., for \u00a0 instead
    this.options = options;
}
JASSStringifier.prototype.output = function () {
    return this.str;
};
// Todo: fix references to this to include level-changing directives
JASSStringifier.prototype.getIndent = function () {
    return _repeat(this.indent, this.indentChr);
};
JASSStringifier.prototype.charset = function (charset) {
    this.str += charset ? '@charset "' + charset + '";\n' : '';
};
JASSStringifier.prototype['import'] = function (imprt, options) {
    this.str += '@import "';
    if (!Array.isArray(imprt)) {
        this.str += imprt + '"'
    }
    else {
        this.str += imprt[0] + '" ';
        this.media_list(imprt.slice(1), options);
    }
    this.str += ';\n';
};

// We still need the media_list method in order to shuttle it here (so that users can still use the media_list property on their JASS regardless of their media query support options)
JASSStringifier.prototype.media_query_list = function (media, options) {
    function _serializeMediaFeature (mf) {
        return Array.isArray(mf) ? mf[0] + ':' + mf.slice(1).join('') : mf;
    }
    this.str += media.map(function (mq) {
        if (typeof mq === 'string') { // Media type
            return mq;
        }
        if (Array.isArray(mq)) { // Media features expression(s)
            return '(' + mq.map(function (mf) {
                return _serializeMediaFeature(mf);
            }).join(') AND (') + ')';
        }
        // Media type + media features expression(s)
        return (mq.only ? 'ONLY ' : (mq.not ? 'NOT ' : '')) +
            mq.type +
            ((mq.features && mq.features.length) ? mq.features.reduce(function (prev, mf) {
                return prev + ' AND (' + _serializeMediaFeature(mf) + ')';
            }, '') : '');
    }).join(', ');
};

JASSStringifier.prototype.media_list = function (media, options) {
    var withinMedia = this._withinMedia;
    if ((withinMedia && options.noConditionals) || // The conditional spec assumes media queries if within the "media" production, so, when in media, we only avoid it if not permitting the whole conditional spec (one cannot prevent media queries while allowing conditionals)
        (!withinMedia && options.noMediaQueries) // If we are not within media, media queries will be allowed unless explicitly denied
    ) {
        this.str += media.join(', ');
    }
    else {
        this.media_query_list(media, options);
    }
};
JASSStringifier.prototype.imports = function (imports, options) {
    imports.forEach(function (imprt) {
        this['import'](imprt, options);
    }, this);
};
JASSStringifier.prototype.namespace = function (namespace, options) {
    this.str += '@namespace ' + (Array.isArray(namespace) ? namespace[0] + ' "' + namespace[1] : '"' + namespace) + '";\n';
};
JASSStringifier.prototype.namespaces = function (namespaces, options) {
    if (options.noNamespaces) {
        return;
    }
    namespaces.forEach(function (namespace) {
        this.namespace(namespace, options);
    }, this);
};

JASSStringifier.prototype.declaration = function (declaration, options) {
    var remainder = declaration.slice(2),
        last = remainder.length - 1;
    if (remainder[last] === 'important') {
        remainder[last] = ' !important';
    }
    this.str += this.getIndent() + declaration[0] + ': ' + declaration[1] + (remainder.length ? remainder.join('') : '');
};
JASSStringifier.prototype.declarations = function (declarations, options) {
    declarations.forEach(function (declaration) {
        this.declaration(declaration, options);
        this.str += ';\n';
    }, this);
};

JASSStringifier.prototype.page = function (page, options) {
    this.str += '@page ' + (page.pseudo ? ':' + page.pseudo + ' ' : '') + '{\n';
    this.declarations(page.declarations, options)
    this.str += '}\n';
};

// todo: finish
// Todo: Not all rulesets can potentially be nested statements, since plain rulesets (not nested-supporting media statements or @supports (and in CSS4, there should be @document as well)) are still directly allowed within the "stylesheet" production
JASSStringifier.prototype.ruleset = function (ruleset, options) {
    this.str += ruleset + ';\n';
};

JASSStringifier.prototype.rulesets = function (rulesets, options) {
    rulesets.forEach(function (ruleset) {
        this.ruleset(ruleset, options);
    }, this);
};

// todo: finish
// future CSS specifications that add new @-rules that are not forbidden to occur after some other types of rules should modify this nested_statement production to keep the grammar accurate. 
// http://dev.w3.org/csswg/css-conditional/#nested_statement
// Todo: ensure handling http://dev.w3.org/csswg/css-page/#syntax-prod-page as in this.rulesets
JASSStringifier.prototype.nested_statements = function (statements, options) {
    
};

JASSStringifier.prototype.pageSelector = function (selector, options) {
    var selectors;
    if (selector && typeof selector === 'object' && !Array.isArray(selector)) {
        this.str += selector.id;
        selectors = selector.pseudos;
        if (!selectors) { // The spec allows an IDENT without a pseudo_page: http://dev.w3.org/csswg/css-page/#page_selector
            return;
        }
        this.pageSelectors(selectors, options);
        return;
    }
    this.str += ':' + selector; // "left" | "right" | "first" | "blank" // Apparently no spaces are allowed between the page selectors per http://dev.w3.org/csswg/css-page/#page_selector_list
};

JASSStringifier.prototype.pageSelectors = function (selectors, options) {
    selectors.forEach(function (selector, i) {
        if (i > 0) {
            this.str += ', '; // Reporting as errata that whitespace supposedly not allowed after comma (only before): http://dev.w3.org/csswg/css-page/#page_selector_list
        }
        this.pageSelector(selector, options);
    }, this);
};

// http://dev.w3.org/csswg/css-page/#syntax-prod-margin
JASSStringifier.prototype.margins = function (margins, options) {
    var declarations = margins.slice(1);
    this.str += '@' + margins[0] + ' {\n'; // ['top-left-corner', 'top-left', 'top-center', 'top-right', 'top-right-corner', 'bottom-left-corner', 'bottom-left', 'bottom-center', 'bottom-right', 'bottom-right-corner', 'left-top', 'left-middle', 'left-bottom', 'right-top', 'right-middle', 'right-bottom']
    this.declarations(declarations, options); // It appears safe to reuse this method
    this.str += '\n}\n'; // page_margin_box per http://dev.w3.org/csswg/css-page/#syntax-prod-margin doesn't appear to support whitespace before the closing curly brace; reporting as errata
};

// Allows any number (including 0) of semi-colon separated declaration/page_margin_box(s)+declaration?*
JASSStringifier.prototype.pageBodies = function (bodies, options) {
    bodies.forEach(function (body, i) {
        if (i > 0) {
            this.str += '; ';
        }
        this.pageBody(body, options);
    }, this);
};

JASSStringifier.prototype.pageBody = function (body, options) {
    if (body.margins) {
        this.margins(body.margins, options);
        if (body.declaration) {
            this.declaration(body.declaration, options);
        }
    }
    else { // if (Array.isArray(body) && body.length) {
        this.declaration(body.declaration || body, options);
    }
};
/*
The above pageBody/pageBodies combination should be an exact equivalent of the following single pageBody method (besides disallowing the production to begin with a semicolon) which follows the spec more clearly but unnecessarily encumbers the user with more objects
JASSStringifier.prototype.pageBody = function (body, options) {
    if (body.margins) {
        this.margins(body.margins, options);
        if (body.body) { // Can be empty so we don't require the property
            this.pageBody(body.body, options);
        }
    }
    else { // Can be empty
        if (body.declaration) {
            this.declaration(body.declaration, options);
        }
        if (body.body) { // Per http://dev.w3.org/csswg/css-page/#page_body it appears that this body can occur independently of the previous optional declaration; reporting as apparent errata
            this.str += '; ';
            this.pageBody(body.body, options);
        }
    }
};
*/

// http://dev.w3.org/csswg/css-page/#syntax-prod-page
JASSStringifier.prototype.pageRule = function (pageRule, options) {
    this.str += '@page ';
    this.pageSelectors(pageRule.selectors, options);
    this.str += ' {\n'; // Reporting as errata that http://dev.w3.org/csswg/css-page/#syntax-prod-page does not allow whitespace before the opening curly bracket (nor before the ending one)
    if (pageRule.bodies) { // Since this can be empty, the user can avoid the property entirely
        this.pageBodies(pageRule.bodies, options);
    }
    this.str += '}\n';
};

JASSStringifier.prototype.mediaRule = function (rule, options) {
    if (Array.isArray(rule)) {
        this.ruleset(rule, options);
    }
    else if (rule.pageRule && !options.noPageInMedia) { // Conditionals don't seem to allow "page" (while expanding other allowable content within @media and also @supports) but presumably the Paged Media Module updates this at http://dev.w3.org/csswg/css-page/#media (even though http://dev.w3.org/csswg/css-conditional/#nested_statement fails to include page_rule here)
        this.pageRule(rule.pageRule, options);
    }
    else if (!options.noConditionals) {
        // Todo: shuffle above to nested_statements unless not supported?
        // todo: check for media, font_face_rule, keyframes_rule, supports_rule allowed in conditionals
        // this.nested_statements(rules, options); // reconcile with fact that supports will want to use this
    }
    
};

JASSStringifier.prototype.mediaRules = function (mediaRules, options) {
    mediaRules.forEach(function (mediaRule) {
        this.mediaRule(mediaRule, options);
    }, this);
};

// "media" in http://www.w3.org/TR/CSS2/grammar.html and http://dev.w3.org/csswg/css-conditional/#media
JASSStringifier.prototype.media = function (media, options) {
    this.str += '@media ';
    this._withinMedia = true;

    this.media_list(media.media, options);
    this._withinMedia = false;
    
    // "group_rule_body" in http://dev.w3.org/csswg/css-conditional/#media
    this.str += ' {\n'; // The preceding space seems disallowed per grammar http://www.w3.org/TR/CSS2/grammar.html (and also per http://dev.w3.org/csswg/css-conditional/#media ) but shown at http://www.w3.org/TR/CSS2/media.html#at-media-rule and http://dev.w3.org/csswg/css-conditional/#at-media (reported as errata)

    this.mediaRules(media.rules, options);
    this.str += '}\n';
};

// Todo: finish
// http://dev.w3.org/csswg/css-fonts/#font-face-rule
JASSStringifier.prototype.fontFace = function (fontFace, options) {
    
};

// Todo: finish
// http://dev.w3.org/csswg/css-conditional/#at-supports
JASSStringifier.prototype.supports = function (supports, options) {


};
// Todo: finish
// http://dev.w3.org/csswg/css-animations/#keyframes
JASSStringifier.prototype.keyframes = function (keyframes, options) {
    
};


JASSStringifier.prototype.rules = function (rules, options) {
    rules.forEach(function (rule) {
        if (Array.isArray(rule)) {
            this.ruleset(rule, options);
        }
        else if (rule.page) {
            this.page(rule.page, options);        
        }
        else if (rule.media) {
            this.media(rule, options);
        }
        else if (rule.supports && !options.noConditionals) { // Per http://dev.w3.org/csswg/css-conditional/#grammar
            this.supports(rule.supports, options);
        }
        else if (rule.keyframes && !options.noKeyframes) {
            this.keyframes(rule.keyframes, options);
        }
        else if (rule.fontFace && !options.noFontFace) {
            this.fontFace(rule.fontFace, options);
        }
        /*
        // Will also need to exclude if only set to support CSS3
        else if (rule.document && !options.noConditionals) { // Per http://dev.w3.org/csswg/css-conditional/#grammar
            this.document(rule.document, options);
        }
        */
    }, this);
};


JASS.stringify = function (jass, options) {
    return JASS(jass, new JASSStringifier(options), options);
};
JASS.cssomify = function (jass, options) {
    return JASS(jass, new JASSCSSOMify(options), options);
};

window.JASS = JASS;

}());
