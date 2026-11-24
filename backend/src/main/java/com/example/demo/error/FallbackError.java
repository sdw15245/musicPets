package com.example.demo.error;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 컨트롤러에서 예상하지 못한 예외가 났을 때 보낼 코드. 붙이지 않으면 INTERNAL_ERROR. */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface FallbackError {
    ErrorCode value();
}
