package com.example.demo.ratelimit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 이 엔드포인트가 쓰는 요청 예산. 외부 API를 부르는 비싼 요청에 붙인다.
 * 붙이지 않은 엔드포인트는 GET/HEAD면 READ, 나머지는 WRITE 예산을 쓴다.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimited {
    RequestLimits.Operation value();
}
