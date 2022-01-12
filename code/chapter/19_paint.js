// save方法里 将canvas转换成dataUrl数据： https://stackoverflow.com/questions/13198131/how-to-save-an-html5-canvas-as-an-image-on-a-server
// loadUrl加载方法里 将dataUrl数据导入到canvas https://stackoverflow.com/questions/8473205/convert-and-insert-base64-data-to-canvas-in-javascript
// 他的例子都做好了 赞

// 和React.createElement类似 用js的函数创建dom函数 还有全局变量
function elt(name, attributes) {
  var node = document.createElement(name);
  if (attributes) {
    for (var attr in attributes)
      if (attributes.hasOwnProperty(attr))
        node.setAttribute(attr, attributes[attr]);
  }
  for (var i = 2; i < arguments.length; i++) {
    var child = arguments[i];
    if (typeof child == "string")
      child = document.createTextNode(child);
    node.appendChild(child);
  }
  return node;
}
var controls = Object.create(null);
var tools = Object.create(null);

// 入口函数
function createPaint(parent) {
  var canvas = elt("canvas", {width: 500, height: 300});
  var cx = canvas.getContext("2d");
  var toolbar = elt("div", {class: "toolbar"});
  for (var name in controls)
    toolbar.appendChild(controls[name](cx));  // appendChilde 是 node的方法 给节点添加子元素

  var panel = elt("div", {class: "picturepanel"}, canvas);
  parent.appendChild(elt("div", null, panel, toolbar));
}


// 下面是controls的集合 是控件 选择加载 保存 工具啥的
controls.tool = function(cx) {
  var select = elt("select");
  for (var name in tools)
    select.appendChild(elt("option", null, name));

  cx.canvas.addEventListener("mousedown", function(event) {
    if (event.which == 1) {
      tools[select.value](event, cx);  // 每次 切换工具后给canvas绑定上响应的mousedown事件，传入event和cx参数 cx是canvas参数 event是mouse参数
      event.preventDefault();
    }
  });

  return elt("span", null, "Tool: ", select);
};
controls.color = function(cx) {
  var input = elt("input", {type: "color"});
  input.addEventListener("change", function() {
    cx.fillStyle = input.value;
    cx.strokeStyle = input.value;
  });
  return elt("span", null, "Color: ", input);
};
controls.brushSize = function(cx) {
  var select = elt("select");
  var sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];
  sizes.forEach(function(size) {
    select.appendChild(elt("option", {value: size},
                           size + " pixels"));
  });
  select.addEventListener("change", function() {
    cx.lineWidth = select.value;
  });
  return elt("span", null, "Brush size: ", select);
};
controls.save = function(cx) {
  var link = elt("a", {href: "/"}, "Save");
  function update() {
    try {
      link.href = cx.canvas.toDataURL();
    } catch (e) {
      if (e instanceof SecurityError)
        link.href = "javascript:alert(" +
          JSON.stringify("Can't save: " + e.toString()) + ")";
      else
        throw e;
    }
  }
  link.addEventListener("mouseover", update);
  link.addEventListener("focus", update);
  return link;
};
function loadImageURL(cx, url) {
  var image = document.createElement("img");
  image.addEventListener("load", function() {
    var color = cx.fillStyle, size = cx.lineWidth;
    cx.canvas.width = image.width;
    cx.canvas.height = image.height;
    cx.drawImage(image, 0, 0);
    cx.fillStyle = color;
    cx.strokeStyle = color;
    cx.lineWidth = size;
  });
  image.src = url;
}
controls.openFile = function(cx) {
  var input = elt("input", {type: "file"});
  input.addEventListener("change", function() {
    if (input.files.length == 0) return;
    var reader = new FileReader();
    reader.addEventListener("load", function() {
      loadImageURL(cx, reader.result);
    });
    reader.readAsDataURL(input.files[0]);
  });
  return elt("div", null, "Open file: ", input);
};
controls.openURL = function(cx) {
  var input = elt("input", {type: "text"});
  var form = elt("form", null,
                 "Open URL: ", input,
                 elt("button", {type: "submit"}, "load"));
  form.addEventListener("submit", function(event) {
    event.preventDefault();
    loadImageURL(cx, input.value);
  });
  return form;
};


// 下面是tools的集合 是绘图的工具
// 两个tools的公共函数
function relativePos(event, element) {
  var rect = element.getBoundingClientRect();
  return {x: Math.floor(event.clientX - rect.left),
    y: Math.floor(event.clientY - rect.top)};
}
function trackDrag(onMove, onEnd) {
  function end(event) {
    removeEventListener("mousemove", onMove);
    removeEventListener("mouseup", end);
    if (onEnd)
      onEnd(event);
  }
  addEventListener("mousemove", onMove);
  addEventListener("mouseup", end);
}

tools.Line = function(event, cx, onEnd) {
  cx.lineCap = "round";

  var pos = relativePos(event, cx.canvas);
  trackDrag(function(event) {
    cx.beginPath();
    cx.moveTo(pos.x, pos.y);
    pos = relativePos(event, cx.canvas);
    cx.lineTo(pos.x, pos.y);
    cx.stroke();
  }, onEnd);
};

tools.Erase = function(event, cx) {
  cx.globalCompositeOperation = "destination-out";
  tools.Line(event, cx, function() {
    cx.globalCompositeOperation = "source-over";
  });
};

tools.Text = function(event, cx) {
  var text = prompt("Text:", "");
  if (text) {
    var pos = relativePos(event, cx.canvas);
    cx.font = Math.max(7, cx.lineWidth) + "px sans-serif";
    cx.fillText(text, pos.x, pos.y);
  }
};

function randomPointInRadius(radius) {
  for (;;) {
    var x = Math.random() * 2 - 1;
    var y = Math.random() * 2 - 1;
    if (x * x + y * y <= 1)
      return {x: x * radius, y: y * radius};
  }
}
tools.Spray = function(event, cx) {
  var radius = cx.lineWidth / 2;
  var area = radius * radius * Math.PI;
  var dotsPerTick = Math.ceil(area / 30);

  var currentPos = relativePos(event, cx.canvas);
  var spray = setInterval(function() {
    for (var i = 0; i < dotsPerTick; i++) {
      var offset = randomPointInRadius(radius);
      cx.fillRect(currentPos.x + offset.x,
                  currentPos.y + offset.y, 1, 1);
    }
  }, 25);
  trackDrag(function(event) {
    currentPos = relativePos(event, cx.canvas);
  }, function() {
    clearInterval(spray);
  });
};

function rectangleFrom(a, b) {
  return {left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)};
}
tools.Rectangle = function(event, cx) {
  var relativeStart = relativePos(event, cx.canvas);
  var pageStart = {x: event.pageX, y: event.pageY};

  var trackingNode = document.createElement("div");
  trackingNode.style.position = "absolute";
  trackingNode.style.background = cx.fillStyle;
  document.body.appendChild(trackingNode);

  trackDrag(function(event) {
    var rect = rectangleFrom(pageStart,
        {x: event.pageX, y: event.pageY});
    trackingNode.style.left = rect.left + "px"; // 这个是拖动动态的展示效果 不然canvas只能最后才展示出来
    trackingNode.style.top = rect.top + "px";
    trackingNode.style.width = rect.width + "px";
    trackingNode.style.height = rect.height + "px";
  }, function(event) {
    var rect = rectangleFrom(relativeStart,
        relativePos(event, cx.canvas));
    cx.fillRect(rect.left, rect.top, rect.width, rect.height);
    document.body.removeChild(trackingNode);
  });
};

function circleForm(a, b) {
  var m = Math.abs(a.x - b.x)
  var n = Math.abs(a.y - b.y)
  var radius = Math.sqrt(m * m + n * n)
  return {
    left: a.x - radius,
    top: a.y - radius,
    width: 2 * radius,
    height: 2 * radius
  }
}
tools.Circle = function(event, cx) {
  var relativeStart = relativePos(event, cx.canvas);
  var pageStart = {x: event.pageX, y: event.pageY}

  var trackingNode = document.createElement("div");
  trackingNode.style.position = "absolute";
  trackingNode.style.background = cx.fillStyle;
  trackingNode.style.borderRadius = "50%";
  document.body.appendChild(trackingNode);

  trackDrag(function(event) {
    var circle = circleForm(pageStart,
        {x: event.pageX, y: event.pageY});
    trackingNode.style.left = circle.left + "px";
    trackingNode.style.top = circle.top + "px";
    trackingNode.style.width = circle.width + "px";
    trackingNode.style.height = circle.height + "px";
  }, function(event) {
    var circle = circleForm(relativeStart,
        relativePos(event, cx.canvas))
    cx.beginPath();
    cx.arc(relativeStart.x, relativeStart.y, circle.width/2, 0, 2*Math.PI);
    cx.fill();
    document.body.removeChild(trackingNode);
  })
}

// Call a given function for all horizontal and vertical neighbors
// of the given point.
function forAllNeighbors(point, fn) {
  fn({x: point.x, y: point.y + 1});
  fn({x: point.x, y: point.y - 1});
  fn({x: point.x + 1, y: point.y});
  fn({x: point.x - 1, y: point.y});
}
// Given two positions, returns true when they hold the same color.
function isSameColor(data, pos1, pos2) {
  var offset1 = (pos1.x + pos1.y * data.width) * 4;
  var offset2 = (pos2.x + pos2.y * data.width) * 4;
  for (var i = 0; i < 4; i++) {
    if (data.data[offset1 + i] != data.data[offset2 + i])
      return false;
  }
  return true;
}
tools["Flood fill"] = function(event, cx) {
  var startPos = relativePos(event, cx.canvas);

  var data = cx.getImageData(0, 0, cx.canvas.width,
      cx.canvas.height);
  // An array with one place for each pixel in the image.
  var alreadyFilled = new Array(data.width * data.height);

  // This is a list of same-colored pixel coordinates that we have
  // not handled yet.
  var workList = [startPos];
  while (workList.length) {
    var pos = workList.pop();
    var offset = pos.x + data.width * pos.y;
    if (alreadyFilled[offset]) continue;

    cx.fillRect(pos.x, pos.y, 1, 1);
    alreadyFilled[offset] = true;

    forAllNeighbors(pos, function(neighbor) {
      if (neighbor.x >= 0 && neighbor.x < data.width &&
          neighbor.y >= 0 && neighbor.y < data.height &&
          isSameColor(data, startPos, neighbor))
        workList.push(neighbor);
    });
  }
};


