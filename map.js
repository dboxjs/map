import * as d3 from 'd3';
/*
 * Map 
 */

export default function(config) {

  function Map(config) {
    var vm = this;
    vm._config = config ? config : {};
    vm._data = [];
    vm._scales = {};
    vm._axes = {};
    vm._tip = vm.utils.d3.tip().attr('class', 'd3-tip');

    vm._formatWithZeroDecimals  = d3.format(",.0f");
    vm._formatWithOneDecimal    = d3.format(",.1f");
    vm._formatWithTwoDecimals   = d3.format(",.2f");
    vm._formatWithThreeDecimals = d3.format(",.3f");

    vm._format = {};
    vm._format.total = vm._formatWithZeroDecimals;
    vm._format.percentage = function(d){return d3.format(",.1f")(d) + '%';} ;
    vm._format.change =  d3.format(",.1f");

  }

  //-------------------------------
  //User config functions

  Map.prototype.id = function(col) {
    var vm = this;
    vm._config.id = col;
    return vm;
  }

  Map.prototype.color = function(col) {
    var vm = this;
    vm._config.color = col;
    return vm;
  }

  Map.prototype.tip = function(tip){
    var vm = this;
    vm._config.tip = tip;
    vm._tip.html(vm._config.tip);
    return vm;
  }

  Map.prototype.onclick = function(onclick){
    var vm = this;
    vm._config.onclick = onclick;
    return vm;
  }

  Map.prototype.end = function() {
    var vm = this;
    return vm._chart;
  }

  //-------------------------------
  //Triggered by the chart.js;
  Map.prototype.chart = function(chart) {
    var vm = this;
    vm._chart = chart;
    return vm;
  }

 
  Map.prototype.data = function(data) {
    var vm = this;
    
    vm._topojson = data[1]? data[1] : false ; //Topojson
    var data = data[0]; //User data

    if(vm._config.data.filter){
      data = data[0].filter(vm._config.data.filter);
    }
  
    vm._data = data;
    vm._quantiles = vm._setQuantile(data);
    vm._minMax = d3.extent(data, function(d) { return +d[vm._config.color]; })

    vm._config.map.min = vm._minMax[0];
    vm._config.map.max = vm._minMax[1];

    return vm;
  }

  Map.prototype.scales = function(s) {
    var vm = this;
    vm._scales = s;
    return vm;
  }

  Map.prototype.axes = function(a) {
    var vm = this;
    vm._axes = a;
    return vm;
  }

  Map.prototype.domains = function() {
    var vm = this;
    return vm;
  };

  Map.prototype.draw  = function(){
    var vm = this;

    //@config
    var urlTopojson = vm._config.map.topojson.url;
    var objects = vm._config.map.topojson.objects; //'states'
    var tran = vm._config.map.topojson.translate; //var tran = [2580, 700];
    var scale = vm._config.map.topojson.scale; //1300
    
    var parser = vm._config.map.topojson.parser;
   
    var id = vm._config.map.topojson.id;

    //Call the tip
    vm._chart._svg.call(vm._tip)

    vm._projection = d3.geoMercator()
        .scale(scale)
        .translate(tran);

    vm.path = d3.geoPath()
        .projection(vm._projection);

    vm._polygons = vm._chart._svg.append("g")
        .attr("id", "dbox-map-polygons")
        .style('display', 'true')
        .attr("transform", function() {
            return "translate(" + (vm._config.size.translateX) + ",100) scale(" + vm._config.size.scale + ")"
        });
    
    var features = topojson.feature(vm._topojson, vm._topojson.objects[objects]).features;

    if (typeof vm._config.map.topojson.filter != 'undefined') {
      var filter = vm._config.map.topojson.filter;
      Object.keys(filter).map(function(key) {
        features = features.filter(feature => feature.properties[key] === filter[key]);
      });
    }

    vm._polygons.selectAll("path")
        .data(features, parser)
        .enter().append("path")
        .attr("d", d3.geoPath().projection(vm._projection))
        .attr("id", id) 
        .attr("data-geotype", objects)
        .attr("fill", "#808080")
        .attr('stroke', '#a0a0a0')
        .style('stroke-width', '1px')
        .on('mouseover', function(d, i) {
        
          if(vm._config.map.quantiles.colorsOnHover){ //OnHover colors
            d3.select(this).attr('fill', function(d) {
                return vm._getQuantileColor(d[vm._config.color],'onHover');
            })
          }

          //vm._tip.show(d, d3.select(this).node()) //Show TIP

          if (vm._config.data.onmouseover) { //External function call
            vm._config.data.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function(d, i) {

            if(vm._config.map.quantiles.colorsOnHover){ //OnHover reset default color
              d3.select(this).attr('fill', function(d) {
                  return vm._getQuantileColor(d[vm._config.color],'default');
              })
            }
            //Hide tip
            //vm._tip.hide(d, d3.select(this).node()) 

            if (vm._config.data.onmouseout) { //External function call
              vm._config.data.onmouseout.call(this, d, i)
            }
            
        })
        .on("click", function(d, i) {
            if (vm._config.data.onclick) {
                vm._config.data.onclick.call(this, d, i)
            }
        })

    vm._polygonsDefault = vm._polygons.selectAll("path").data();

    vm._polygons.selectAll("path").attr("stroke", "#333").attr('stroke-width', 0.2);
    vm._polygons.selectAll("path").attr("fill", "red");
    vm._polygons.selectAll("path").attr('data-total', null);
    vm._polygons.selectAll("path")
        .data(vm._data, function(d) {
          //@TODO WHY THE F..K IS D3 ITERATING OVER THE OLD DATA
          return d.id ? d.id : d[vm._config.id];
        })
        .attr('fill', function(d) {
            return vm._getQuantileColor(d[vm._config.color],'default');
        })
        .attr('data-total', function(d) {
            return +d[vm._config.color];
        })

    //Resets the map paths data to topojson
    vm._polygons.selectAll("path").data(vm._polygonsDefault, function(d) {
        return d.id;
    });


  };

  Map.prototype._setQuantile = function(data){
    var vm = this; 
    var values = [];
    var quantile = []; 

    if(vm._config.map.quantiles &&  vm._config.map.quantiles.predefinedQuantiles 
        && vm._config.map.quantiles.predefinedQuantiles.length > 0){
      return vm._config.map.quantiles.predefinedQuantiles;
    }

    data.forEach(function(d){      
      values.push(+d[vm._config.color]);
    });

    values.sort(d3.ascending);
    
    //@TODO use quantile scale instead of manual calculations 
    if(vm._config && vm._config.map && vm._config.map.quantiles && vm._config.map.quantiles.buckets){

      if(vm._config.map.quantiles.ignoreZeros === true){
        var aux = _.dropWhile(values, function(o) { return o <= 0 });
        //aux.unshift(values[0]);  

        quantile.push(values[0]);
        quantile.push(0);
        
        for(var i = 1; i <= vm._config.map.quantiles.buckets - 1; i++ ){        
          quantile.push( d3.quantile(aux,  i* 1/(vm._config.map.quantiles.buckets - 1) ) )
        }

      }else{
        quantile.push( d3.quantile(values, 0) )
        for(var i = 1; i <= vm._config.map.quantiles.buckets; i++ ){        
          quantile.push( d3.quantile(values,  i* 1/vm._config.map.quantiles.buckets ) )
        }
      }
        
    }else{
      quantile = [ d3.quantile(values, 0), d3.quantile(values, 0.2), d3.quantile(values, 0.4), d3.quantile(values, 0.6), d3.quantile(values, 0.8), d3.quantile(values,1) ];
    }
   
    //@TODO - VALIDATE WHEN ZEROS NEED TO BE PUT ON QUANTILE 1 AND RECALCULATE NON ZERO VALUES INTO THE REST OF THE BUCKETS
    if( vm._config.map.quantiles && vm._config.map.quantiles.buckets 
        && vm._config.map.quantiles.buckets === 5){

      if( quantile[1] === quantile[2] && quantile[2] === quantile[3] && quantile[3] === quantile[4] && quantile[4] === quantile[5]){
        quantile = [ d3.quantile(values, 0), d3.quantile(values, 0.2) ];
      }
    }
   
    return quantile;
  }

  Map.prototype._getQuantileColor = function(d,type){
    var vm = this; 
    var total = parseFloat(d);

    //@TODO use quantile scale instead of manual calculations 
    if(vm._config && vm._config.map && vm._config.map.quantiles && vm._config.map.quantiles.colors){
      if(vm._quantiles.length > 2){

        if(vm._config && vm._config.map && vm._config.map.min !== undefined && vm._config.map.max !== undefined){
          if(total < vm._config.map.min || total > vm._config.map.max){
            console.log('outOfRangeColor', total, vm._config.map.min ,vm._config.map.max)
            return vm._config.map.quantiles.outOfRangeColor; 
          }
        }else{
          if(total < vm._minMax[0] || total > vm._minMax[1]){
            console.log('outOfRangeColor', total, vm._config.map.min ,vm._config.map.max)
            return vm._config.map.quantiles.outOfRangeColor; 
          }
        }

        if(type == 'default'){
          if(total <= vm._quantiles[1]){
            return vm._config.map.quantiles.colors[0];//"#f7c7c5";
          }else if(total <= vm._quantiles[2]){
            return vm._config.map.quantiles.colors[1];//"#e65158";
          }else if(total <= vm._quantiles[3]){
            return vm._config.map.quantiles.colors[2];//"#c20216";
          }else if(total <= vm._quantiles[4]){
            return vm._config.map.quantiles.colors[3];//"#750000";
          }else if(total <= vm._quantiles[5]){
            return vm._config.map.quantiles.colors[4];//"#480000";
          }
        }

        if(type == 'onHover' && vm._config.map.quantiles.colorsOnHover){
          if(total <= vm._quantiles[1]){
            return vm._config.map.quantiles.colorsOnHover[0];//"#f7c7c5";
          }else if(total <= vm._quantiles[2]){
            return vm._config.map.quantiles.colorsOnHover[1];//"#e65158";
          }else if(total <= vm._quantiles[3]){
            return vm._config.map.quantiles.colorsOnHover[2];//"#c20216";
          }else if(total <= vm._quantiles[4]){
            return vm._config.map.quantiles.colorsOnHover[3];//"#750000";
          }else if(total <= vm._quantiles[5]){
            return vm._config.map.quantiles.colorsOnHover[4];//"#480000";
          }
        }

      }
    }

    if(vm._quantiles.length == 2){
      /*if(total === 0 ){
        return d4theme.colors.quantiles[0];//return '#fff';
      }else if(total <= vm._quantiles[1]){
        return d4theme.colors.quantiles[1];//return "#f7c7c5";
      }*/
      if(total <= vm._quantiles[1]){
        return vm._config.map.quantiles.colors[0];//"#f7c7c5";
      }
    }

  }






 return new Map(config);
}