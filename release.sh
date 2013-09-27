mkdir temp
cd build
./generate.sh
cd ..
cp dist/* temp
cp -r examples temp
git checkout release
cp -r temp/* .
rm -rf temp

