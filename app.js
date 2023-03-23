import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import expandCollapse from 'cytoscape-expand-collapse'


const layoutOpts = {
  name: 'fcose',
  animate: false,
  randomize: false,
  quality: 'proof',
  minEdgeLength: 50,
}

const cyStyle = [
  {
    selector: 'node',
    style: {
      'overlay-opacity': 0,
      'background-color': '#636fb1',
      'border-color': '#636fb1',
      label: 'data(label)',
      width: 70,
      height: 20,
      "shape": "rectangle",
      "font-size": 4,
      'z-index-compare': 'manual',
      'z-index': (node) => node.ancestors().length * 10,
      'z-compound-depth': 'orphan'
    }
  },
  {
    selector: 'node:parent',
    style: {
      'background-opacity': 0.66,
      'background-color': 'lightgray',
      'border-color': 'green',
      "font-size": 8,
      'z-index': (node) => node.ancestors().length * 10 + 2,
    }
  },
  {
    selector: "node.cy-expand-collapse-collapsed-node",
    style: {
      "background-color": "green",
      'border-color': 'green',
      "shape": "rectangle",
      'text-halign': 'center',
      'text-valign': 'center',
    }
  },
  {
    selector: "[element]",
    style: {
      'text-halign': 'center',
      'text-valign': 'center',
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': '#6368b1',
      'curve-style': 'straight',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#6368b1',
      'arrow-scale': '0.5',
      'z-index': (edge) => (
        Math.max(edge.source().ancestors().length, edge.target().ancestors().length) * 10 + 1
      ),
      'z-index-compare': 'manual',
      'z-compound-depth': 'orphan',
      'overlay-opacity': 0,
    }
  },
  {
    selector: 'edge.meta',
    style: {
      'width': 2,
      'line-color': 'red'
    }
  },
  {
    selector: ':selected',
    style: {
      'border-style': 'dashed',
      'border-width': '1px',
    }
  }
]

const areNodesInViewport = (cy, nodes) => {
  const ext = cy.extent()
  return nodes.every(node => {
    const bb = node.boundingBox();
    return bb.x1 > ext.x1 && bb.x2 < ext.x2 && bb.y1 > ext.y1 && bb.y2 < ext.y2;
  });
}

function globalPanning(cy, enabled) {
  let startPosition;
  cy.on('mousedown', 'node, edge', (evt) => {
    const e = evt.originalEvent;
    if (enabled(evt) && e.button === 0) {
      startPosition = evt.position;
    }
  });
  cy.on('mouseup', (evt) => {
    const e = (evt.originalEvent);
    if (e.button === 0) {
      startPosition = null;
    }
  });
  cy.on('mousemove', (evt) => {
    const e = (evt.originalEvent);
    if (startPosition) {
      const zoom = cy.zoom();
      const relativePosition = {
        x: (evt.position.x - startPosition.x) * zoom,
        y: (evt.position.y - startPosition.y) * zoom,
      };
      cy.panBy(relativePosition);
    }
  });
}

export class MembraneGraph {

  interactedItem = null;
  interactionTimeout = null;
  ctrlKeyPressed = false;

  constructor(container) {
    container.innerHTML = `
    <div style="width: 100%; height: 100%">
      <div class="menu-container" style="position: absolute;z-index: 1000;padding: 20px;">
        <button id="collapseAll">Collapse all</button>
        <button id="expandAll">Expand all</button>
        <button id="collapseRecursively">Collapse selected recursively</button>
        <button id="expandRecursively">Expand selected recursively</button>
        <button id="reLayout">Refresh layout</button>
      </div>

      <div id="cy" style="width: 100%; height: 100%"></div>
    </div>
    `

    cytoscape.use(fcose);
    expandCollapse(cytoscape);
    const cy = cytoscape({
      container: document.getElementById('cy'),
      layout: layoutOpts,
      autoungrabify: true,
      style: cyStyle,
      userZoomingEnabled: false,
    });

    const api = cy.expandCollapse({
      layoutBy: {
        name: "fcose",
        animate: true,
        animationDuration: 300,
        randomize: false,
        fit: false
      },
      animate: false,
      fisheye: true,
      undoable: false,
      expandCueImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAACOUlEQVRo3u1ZyU7CUBQlTguXDiuHnzAS2bEzhDZtSRqM7v0FjStW4B6NEv8A0yGpuHHhN0jwAxxWCq6pG70XaxQSwpvavmpvchNCoT3nDfeed5rJpJFGGtxhNs1pxTZyRVc7Uh3dKjr6veLob/D5HRM/w/XO4Br+xiptVSqVqdiBa662ptrGMYB7BpAflPmkuFqtYJVWIwdeaJrLMJoNAOEzAB9NH4icqZ66FAl41dV24aE9AcBHs1u0jZ3QgG809mdhqVyEAHwogcQ5PkvsqHvqPNz8Omzwv7KFzxQ38tGC/84bqG5z3ASiWDZjEzY3L/i92MD/kCgzgTdsYxFu8Bo7Aah4TCU2qPNMDx0XzJXJ0U/pGhV0R54mJZoAYoFZWCcffZQHHNMeAgHcCzUi8CiyBjpFNgKgt1A0klSeHO/GC4XAV2YnEkC5KysBWNqHJDNgSzsDtnFJQqDDA5I1iGbA0duTCRBK5TgIYGMlIeBLTKD/LwgkfAklfhMnvYzK3MgA28FkIQemk7Sd2Cptkoq5RwkJPBC7eShdJSRQTfKBpq94ygrdgR4cAYkI1KnPxNtNc0GSQ32X2TdFrzJuAoDB5PKG0KuM0RM6EfPywtGdqMGDC36Vv83PiDR3WxES8ISZu0MmL0dlolk2wkZ+THkth1SdXrg3LI1vinbfoMHwA8d71LFsR/6uDLtjIDtYtBP+p0rdYcOIQABm0bdBzY4Hj+Bk5wfZg+/v8BpKYlSVUrxmTSONPxCf9GPtiVNgCLQAAAAASUVORK5CYII=",
      collapseCueImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAACNUlEQVRo3u1Zy07CQBQl6sadj5WPjzCRuQORBXZK2BsgfonPjQsfW40a/8FXDHyJhh9AXaj47kNwU+diTQiJ6dAO7aC9yQ1NSDvntHfu40wiEVtssQU2ZyMxYOs0ZTFYszR6ZjKomjo889/Pln9fVy1GTk1GV+35FMV7IgduZ+m0qdEdDu6Wu9Ol35iMbNtaeip04O8Mxg0djjiIpg/gnd6wGD18y6fHQgFvMLrIF32UALzT64ZOSr2L82x2yH3rTi+d75MDXEsu+HR6mD+80mvwbV7GNeWALxYHDQbnIYL/8YqULxFG2PwaTjrsy9iwTpTOMRR8gce0hpkhagKY8TBt91XoBA6lVoWVU6RkeaOriu22B45KzjPhlnBjxm+4Vo0A9luY0r3Dh3eVCoJvua0lwZOApcG6qgRMDZYFcn8kVVewT4IT7w2Mw4jAw2SbGAlyJULgSV0CUBch0FSYQONfEOj7EOrvTezKImqmUR2OvQlwbUfZQsZgybuV4KKTsl8gB8l+buZqwmoeKmbKtdM6bHY70DRUGmis3NxkV1MZyn3qEKB7/oZ6DR4UIHD/msmM+tSESCn62CcLgbQh1CqjI0B2pUiLEVXnijSR1xV3yyEqEBfSxN12eR0FpjAyjpD6EEAvLWBm6AH4u8AbVtQwrblfQ0ax+8C3/pKdGQn9rAyrIypmPnunGrYHVn52Qo1jVi46mTpZQekDBw93smu6jteXrf+4tsNTM1HimDW22P6AfQExbP9jIk1/vwAAAABJRU5ErkJggg=="
    });

    document.getElementById("collapseRecursively").addEventListener("click", function () {
      api.collapseRecursively(cy.$(":selected"));
    });

    document.getElementById("expandRecursively").addEventListener("click", function () {
      api.expandRecursively(cy.$(":selected"));
    });

    document.getElementById("collapseAll").addEventListener("click", function () {
      api.collapseAll();
      setTimeout(() => cy.animate({ fit: { padding: 50 } }), 305);
    });

    document.getElementById("expandAll").addEventListener("click", function () {
      api.expandAll();
      setTimeout(() => cy.animate({ fit: { padding: 50 } }), 305);
    });

    document.getElementById("reLayout").addEventListener("click", () => this.reLayout());

    cy.on('tap', (event) => {
      const target = event.target;
      target.data("interaction", "tap");
      if (this.interactionTimeout) {
        clearTimeout(this.interactionTimeout);
      }
      if (this.interactedItem === target) {
        target.data("interaction", "doubleTap");
        if (target.isNode && target.isNode()) {
          api.expand(target);
        }
        this.interactedItem = null;
      } else {
        this.interactedItem = target;
      }
      this.interactionTimeout = setTimeout(() => {
        this.interactedItem = null;
        target.data("interaction", null);
      }, 300);
    });


    cy.on("expandcollapse.afterexpand", function (event) {
      const node = event.target;
      setTimeout(() => {
        const interaction = node.data("interaction");
        node.data("interaction", null);
        if (interaction) {
          setTimeout(() => {
            if (interaction == "doubleTap") {
              cy.animate({ fit: { eles: node, padding: 50 } }, { duration: 500 });
            } else if (interaction == "tap") {
              cy.animate({ fit: { eles: node.parent(), padding: 50 } }, { duration: 500 });
            }
          }, 305);
        }
      }, 5);
    });

    cy.on("expandcollapse.aftercollapse", function (event) {
      const node = event.target;
      setTimeout(() => {
        if (node.data("interaction")) {
          node.data("interaction", null)
          setTimeout(() => {
            const parent = !node.isOrphan() && node.parent();
            if (parent && !areNodesInViewport(cy, [parent])) {
              cy.animate({ fit: { eles: parent, padding: 50 } }, { duration: 300 });
            } else if (!parent || areNodesInViewport(cy, cy.nodes())) {
              cy.animate({ fit: { padding: 50 } }, { duration: 300 });
            } else {
              cy.animate({ center: { eles: parent } }, { duration: 300 });
            }
          }, 505);
        }
      }, 5);
    });

    cy.on('mousemove', 'node, edge', (e) => cy.autoungrabify(!e.originalEvent.altKey));
    globalPanning(cy, (e) => !e.originalEvent.altKey);

    document.querySelector("body").addEventListener('click', () => cy.userZoomingEnabled(true));
    document.querySelector("body").addEventListener('mouseleave', () => cy.userZoomingEnabled(false));

    api.collapseRecursively(cy.nodes().filter(node => node.data().bin));

    setTimeout(() => {
      cy.animate({ fit: { padding: 50 } }, { duration: 100 });
    }, 400);

    this.cy = cy;
    this.api = api;
    return this;
  };


  update(add, remove) {
    console.debug("add graph data");
    const { api, cy } = this;
    const collapsed_children = api.getAllCollapsedChildrenRecursively();
    const collapsed_parents = cy.elements(".cy-expand-collapse-collapsed-node");
    api.expandAll();
    console.debug("expanded data");
    if (cy.nodes().length + add.length < 20) {
      const new_elements = add.map(graphElement => {
        const element = cy.add([graphElement]);
        cy.layout(layoutOpts).run();
        return element;
      });
      remove.forEach((id) => cy.remove(cy.$id(id)));
      console.debug("removed data");
      new_elements.forEach((e) => api.collapse(e));
    } else {
      console.debug("adding data");
      const new_elements = cy.add(add);
      console.debug("added data");
      remove.forEach((id) => cy.remove(cy.$id(id)));
      console.debug("removed data");
      cy.layout(layoutOpts).run();
      console.debug("run layout");
      api.collapse(new_elements);
    }
    api.collapse(collapsed_children);
    api.collapse(collapsed_parents);
    console.debug("collapse");
    cy.layout(layoutOpts).run();
    console.debug("run layout again");
  }

  reLayout() {
    const { api, cy } = this;
    const collapsed_children = api.getAllCollapsedChildrenRecursively();
    const collapsed_parents = cy.elements(".cy-expand-collapse-collapsed-node");
    api.expandAll();
    cy.layout(layoutOpts).run();
    api.collapse(collapsed_children);
    api.collapse(collapsed_parents);
    cy.layout(layoutOpts).run();
  }
}

window.MembraneGraph = MembraneGraph;
