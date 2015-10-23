'use strict';

function TopoJsonSqlWrapper(context) {
  this.context = context;
  this.template = "";
}

module.exports = TopoJsonSqlWrapper;

TopoJsonSqlWrapper.prototype.wrap = function () {
    if (this.template) {
        return this.template;
    }

    this.template = "" +
        "WITH par AS (" +
            "WITH innerpar AS (" +
                "SELECT " +
                    "1.0/(({xyz_resolution})*{resolution}) as resinv, " +
                    "ST_MakeEnvelope({b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}, {srid}) as b_ext, " +
                    "ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, {srid}) as ext" +
            ") " +
            "SELECT " +
                "({xyz_resolution})*{resolution} as res, " +
                "innerpar.resinv as resinv, " +
                "innerpar.b_ext as b_ext, " +
                "st_xmin(innerpar.ext) as xmin, " +
                "st_ymin(innerpar.ext) as ymin, " +
                "round((st_xmax(innerpar.ext) - st_xmin(innerpar.ext))*innerpar.resinv) - 1 as maxx, " +
                "round((st_ymax(innerpar.ext) - st_ymin(innerpar.ext))*innerpar.resinv) - 1 as maxy " +
            "FROM innerpar" +
        ") " +
        "SELECT xx x__uint8, " +
             "yy y__uint8, " +
             "array_agg(c) vals__uint8, " +
             "array_agg(d) dates__uint16 " +
        "FROM ( " +
        "select " +
           "GREATEST(0 - {b_size}, LEAST(p.maxx + {b_size}, round((st_x(i.{gcol}) - p.xmin)*resinv))) as xx, " +
           "GREATEST(0 - {b_size}, LEAST(p.maxy + {b_size}, round((st_y(i.{gcol}) - p.ymin)*resinv))) as yy " +
           ", {countby} c " +
           ", floor(({column_conv} - {start})/{step}) d " +
            "FROM ({_sql}) i, par p " +
            "WHERE i.{gcol} && p.b_ext " + this.context.value +
        "GROUP BY xx, yy, d  " +
        ") cte, par  " +
        "GROUP BY x__uint8, y__uint8; ";

    return this.template;
};
