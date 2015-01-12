(function () {'use strict';

var assert = {
    matches: function (item1, item2) {
        if (!item2) { // For convenience in debugging
            alert(item1);
        }
        if (item1 !== item2) {
            alert(item1+'\n\n' + item2);
        }
        document.body.appendChild(document.createTextNode((item1 === item2)));
        document.body.appendChild(document.createElement('br'));
    }
};
window.assert = assert;

}());