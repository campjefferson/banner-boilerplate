import webpack from "webpack";
import path from "path";

const common = path.resolve(__dirname, "./_common/js/");

module.exports = {
  context: __dirname,
  devtool: "sourcemap",
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: "babel-loader"
      }
    ]
  }
};
