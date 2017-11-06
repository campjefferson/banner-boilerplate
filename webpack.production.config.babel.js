import webpack from "webpack";
import path from "path";
import UglifyJSPlugin from "uglifyjs-webpack-plugin";

const common = path.resolve(__dirname, "./_common/js/");

module.exports = {
  context: __dirname,
  devtool: false,
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: "babel-loader"
      }
    ]
  },
  plugins: [new UglifyJSPlugin()]
};
