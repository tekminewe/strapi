## Deploy packages to read-only repo using [split.sh](https://github.com/splitsh/lite)

1. Create package `splitsh-lite --prefix=packages/<package_name>` and copy the sha.
2. Commit the sha to corresponding branch, for example, `packages/<package_name>`
```
$ git push <remote name> <commit hash>:<remote branch name>

# Example:
$ git push origin 2dc2b7e393e6b712ef103eaac81050b9693395a4:master
```
